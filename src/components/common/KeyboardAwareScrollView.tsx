import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { ViewStyle, ScrollViewProps, KeyboardEvent } from 'react-native';
import {
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  View,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  children: React.ReactNode;
  extraScrollHeight?: number;
  enableOnAndroid?: boolean;
  extraHeight?: number;
  innerRef?: React.RefObject<ScrollView>;
  containerStyle?: ViewStyle;
  scrollEnabled?: boolean;
  bounces?: boolean;
}

export const KeyboardAwareScrollView: React.FC<KeyboardAwareScrollViewProps> = ({
  children,
  extraScrollHeight = 50,
  enableOnAndroid = true,
  extraHeight = 0,
  innerRef,
  containerStyle,
  scrollEnabled = true,
  bounces = true,
  ...scrollViewProps
}) => {
  const insets = useSafeAreaInsets();
  const scrollViewRef = innerRef || useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [screenHeight, setScreenHeight] = useState(Dimensions.get('window').height);

  // Calculate proper keyboard vertical offset for different platforms
  const getKeyboardVerticalOffset = (): number => {
    if (Platform.OS === 'ios') {
      // Account for tab bar and safe area on iOS
      return Math.max(insets.bottom, 0) + extraHeight;
    }
    return extraHeight;
  };

  // Handle keyboard events
  useEffect(() => {
    const keyboardWillShow = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates.height);
    };

    const keyboardWillHide = () => {
      setKeyboardHeight(0);
    };

    const keyboardDidShow = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates.height);
    };

    const keyboardDidHide = () => {
      setKeyboardHeight(0);
    };

    // iOS uses will events for smoother animation, Android uses did events
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showHandler = Platform.OS === 'ios' ? keyboardWillShow : keyboardDidShow;
    const hideHandler = Platform.OS === 'ios' ? keyboardWillHide : keyboardDidHide;

    const showSubscription = Keyboard.addListener(showEvent, showHandler);
    const hideSubscription = Keyboard.addListener(hideEvent, hideHandler);

    // Handle screen dimension changes (orientation)
    const dimensionSubscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenHeight(window.height);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      dimensionSubscription.remove();
    };
  }, []);

  // Dismiss keyboard when tapping outside
  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const keyboardVerticalOffset = getKeyboardVerticalOffset();

  // Platform-specific keyboard behavior
  const keyboardBehavior = Platform.select({
    ios: 'padding' as const,
    android: enableOnAndroid ? ('height' as const) : undefined,
  });

  // Calculate content container style with proper padding
  const contentContainerStyle = {
    flexGrow: 1,
    paddingBottom:
      Platform.OS === 'android' ? Math.max(keyboardHeight, extraScrollHeight) : extraScrollHeight,
    ...(scrollViewProps.contentContainerStyle as object),
  };

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, containerStyle]}
      behavior={keyboardBehavior}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
        <View style={{ flex: 1 }}>
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={contentContainerStyle}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.select({
              ios: 'interactive',
              android: 'on-drag',
            })}
            scrollEnabled={scrollEnabled}
            bounces={bounces}
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            onContentSizeChange={(contentWidth, contentHeight) => {
              scrollViewProps.onContentSizeChange?.(contentWidth, contentHeight);
            }}
            onScroll={event => {
              scrollViewProps.onScroll?.(event);
            }}
            {...scrollViewProps}
          >
            <View
              style={{
                minHeight:
                  screenHeight -
                  insets.top -
                  insets.bottom -
                  (Platform.OS === 'android' ? keyboardHeight : 0),
              }}
            >
              {children}
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default KeyboardAwareScrollView;
