import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback, memo, useEffect } from 'react';
import type { TextInputProps, ViewStyle } from 'react-native';
import { View, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';

import { useDebouncedCallback, createSearchInputConfig } from '../../utils/formUtils';

interface SearchInputProps extends Omit<TextInputProps, 'style' | 'onChangeText'> {
  onSearchChange: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  containerStyle?: ViewStyle;
  debounceMs?: number;
  showClearButton?: boolean;
  showSearchIcon?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  accessibilityLabel?: string;
  variant?: 'default' | 'glass';
}

export const SearchInput: React.FC<SearchInputProps> = memo(
  ({
    onSearchChange,
    onSearchSubmit,
    containerStyle,
    debounceMs = 300,
    showClearButton = true,
    showSearchIcon = true,
    isLoading = false,
    placeholder = 'Search...',
    accessibilityLabel = 'Search input',
    variant = 'default',
    testID = 'search-input',
    ...props
  }) => {
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    // Debounced search callback
    const debouncedSearch = useDebouncedCallback(onSearchChange, debounceMs);

    // Create stable search input configuration
    const searchConfig = createSearchInputConfig(
      (text: string) => {
        setQuery(text);
        debouncedSearch(text);
      },
      query,
      {
        placeholder,
        accessibilityLabel,
      }
    );

    const handleFocus = useCallback(
      (event: any) => {
        setIsFocused(true);
        props.onFocus?.(event);
      },
      [props.onFocus]
    );

    const handleBlur = useCallback(
      (event: any) => {
        setIsFocused(false);
        props.onBlur?.(event);
      },
      [props.onBlur]
    );

    const handleClear = useCallback(() => {
      setQuery('');
      onSearchChange('');
    }, [onSearchChange]);

    const handleSubmitEditing = useCallback(
      (event: any) => {
        onSearchSubmit?.(query);
        props.onSubmitEditing?.(event);
      },
      [onSearchSubmit, query, props.onSubmitEditing]
    );

    // Clean up debounced function on unmount
    useEffect(() => {
      return () => {
        // Cleanup will happen automatically with the hook
      };
    }, []);

    const containerStyles = [
      variant === 'glass' ? styles.containerGlass : styles.container,
      isFocused && (variant === 'glass' ? styles.containerGlassFocused : styles.containerFocused),
      containerStyle,
    ];

    const iconColor =
      variant === 'glass'
        ? isFocused
          ? 'rgba(255, 255, 255, 0.9)'
          : 'rgba(255, 255, 255, 0.7)'
        : isFocused
          ? '#007AFF'
          : '#8E8E93';

    const placeholderTextColor = variant === 'glass' ? 'rgba(255, 255, 255, 0.6)' : '#8E8E93';

    return (
      <View style={containerStyles} testID={testID}>
        {showSearchIcon && (
          <Ionicons name="search" size={20} color={iconColor} style={styles.searchIcon} />
        )}

        <TextInput
          style={variant === 'glass' ? styles.inputGlass : styles.input}
          value={query}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={handleSubmitEditing}
          placeholderTextColor={placeholderTextColor}
          accessibilityState={{
            disabled: props.editable === false,
          }}
          testID={`${testID}-field`}
          {...searchConfig}
          {...props}
        />

        {isLoading && (
          <ActivityIndicator
            size="small"
            color={iconColor}
            style={styles.loadingIndicator}
            testID={`${testID}-loading`}
          />
        )}

        {showClearButton && query.length > 0 && !isLoading && (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            testID={`${testID}-clear`}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={20} color={iconColor} />
          </TouchableOpacity>
        )}
      </View>
    );
  }
);

SearchInput.displayName = 'SearchInput';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingHorizontal: 12,
    minHeight: 44,
  },
  containerFocused: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  // Glass variant styles
  containerGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    minHeight: 44,
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 4,
  },
  containerGlassFocused: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: 'rgba(168, 230, 207, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  inputGlass: {
    flex: 1,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 12,
    paddingHorizontal: 0,
    fontWeight: '400',
  },
});
