import React, { useRef, useCallback, memo, useEffect } from 'react';
import type { FlatListProps, ViewToken } from 'react-native';
import { FlatList, Animated, LayoutAnimation, Platform } from 'react-native';

interface AnimatedFlatListProps<T> extends Omit<FlatListProps<T>, 'renderItem'> {
  renderItem: ({
    item,
    index,
    animatedValue,
  }: {
    item: T;
    index: number;
    animatedValue: Animated.Value;
  }) => React.ReactElement | null;
  animationDuration?: number;
  staggerDelay?: number;
  enableViewabilityConfig?: boolean;
}

function AnimatedFlatListComponent<T>({
  renderItem,
  animationDuration = 400,
  staggerDelay = 100,
  enableViewabilityConfig = true,
  onViewableItemsChanged,
  viewabilityConfig,
  ...props
}: AnimatedFlatListProps<T>) {
  const animatedValues = useRef<Map<number, Animated.Value>>(new Map()).current;
  const timeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 10,
    minimumViewTime: 100,
    ...viewabilityConfig,
  });

  // Cleanup memory leaks on unmount
  useEffect(() => {
    return () => {
      // Clear all timeouts
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current.clear();

      // Clear animated values to prevent memory leaks
      animatedValues.clear();
    };
  }, [animatedValues]);

  // Limit memory usage by clearing old animated values
  const MAX_ANIMATED_VALUES = 50;
  const cleanupOldAnimatedValues = useCallback(() => {
    if (animatedValues.size > MAX_ANIMATED_VALUES) {
      const entries = Array.from(animatedValues.entries());
      const toDelete = entries.slice(0, animatedValues.size - MAX_ANIMATED_VALUES);
      toDelete.forEach(([index]) => {
        animatedValues.delete(index);
      });
    }
  }, [animatedValues]);

  const getAnimatedValue = useCallback(
    (index: number) => {
      if (!animatedValues.has(index)) {
        animatedValues.set(index, new Animated.Value(0));
      }
      return animatedValues.get(index)!;
    },
    [animatedValues]
  );

  const animateItem = useCallback(
    (index: number, toValue: number) => {
      const animValue = getAnimatedValue(index);

      Animated.spring(animValue, {
        toValue,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    },
    [getAnimatedValue]
  );

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems, changed }: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
      // Animate items entering/leaving viewport
      changed.forEach(({ index, isViewable }) => {
        if (index !== null) {
          animateItem(index, isViewable ? 1 : 0);
        }
      });

      // Call original onViewableItemsChanged if provided
      onViewableItemsChanged?.({ viewableItems, changed });
    },
    [animateItem, onViewableItemsChanged]
  );

  const renderAnimatedItem = useCallback(
    ({ item, index }: { item: T; index: number }) => {
      const animatedValue = getAnimatedValue(index);

      // Initialize animation for new items
      if (!animatedValues.has(index)) {
        animatedValue.setValue(0);

        // Cleanup old values before creating new ones
        cleanupOldAnimatedValues();

        // Stagger the animation based on index with timeout tracking
        const timeout = setTimeout(
          () => {
            timeoutsRef.current.delete(timeout);
            animateItem(index, 1);
          },
          Math.min(index * staggerDelay, 2000)
        ); // Cap max delay at 2 seconds

        timeoutsRef.current.add(timeout);
      }

      return renderItem({ item, index, animatedValue });
    },
    [
      getAnimatedValue,
      renderItem,
      staggerDelay,
      animateItem,
      animatedValues,
      cleanupOldAnimatedValues,
    ]
  );

  const handleLayout = useCallback(() => {
    // Use LayoutAnimation for smooth layout changes on Android
    if (Platform.OS === 'android') {
      LayoutAnimation.configureNext({
        duration: animationDuration,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
        },
      });
    }
  }, [animationDuration]);

  const optimizedProps = {
    ...props,
    renderItem: renderAnimatedItem,
    removeClippedSubviews: Platform.OS === 'android',
    maxToRenderPerBatch: 8,
    updateCellsBatchingPeriod: 100,
    initialNumToRender: 6,
    windowSize: 10,
    getItemLayout: props.getItemLayout || undefined,
    keyExtractor: props.keyExtractor || ((item: any, index: number) => index.toString()),
    onLayout: handleLayout,
    ...(enableViewabilityConfig && {
      onViewableItemsChanged: handleViewableItemsChanged,
      viewabilityConfig: viewabilityConfigRef.current,
    }),
  };

  return <FlatList {...optimizedProps} />;
}

export const AnimatedFlatList = memo(AnimatedFlatListComponent) as <T>(
  props: AnimatedFlatListProps<T>
) => React.ReactElement;

// Helper component for creating animated list items
interface AnimatedListItemProps {
  children: React.ReactNode;
  animatedValue: Animated.Value;
  style?: any;
  delay?: number;
}

export const AnimatedListItem: React.FC<AnimatedListItemProps> = memo(
  ({ children, animatedValue, style, delay = 0 }) => {
    const translateY = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [50, 0],
    });

    const scale = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.95, 1],
    });

    return (
      <Animated.View
        style={[
          {
            opacity: animatedValue,
            transform: [{ translateY }, { scale }],
          },
          style,
        ]}
      >
        {children}
      </Animated.View>
    );
  }
);
