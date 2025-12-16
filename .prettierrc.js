module.exports = {
  // Prettier configuration for React Native/Expo
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  useTabs: false,
  trailingComma: 'es5',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',
  printWidth: 100,
  endOfLine: 'lf',
  
  // React Native specific
  jsxSingleQuote: false,
  jsxBracketSameLine: false,
  
  // File type specific overrides
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 200,
      },
    },
    {
      files: '*.md',
      options: {
        proseWrap: 'preserve',
      },
    },
  ],
};