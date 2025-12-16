const { withXcodeProject } = require('@expo/config-plugins');

const withBundlePackageType = (config) => {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    
    // Add PRODUCT_BUNDLE_PACKAGE_TYPE to the project
    xcodeProject.addBuildProperty('PRODUCT_BUNDLE_PACKAGE_TYPE', 'APPL');
    console.log('✅ Added PRODUCT_BUNDLE_PACKAGE_TYPE = APPL to Xcode project');
    
    return config;
  });
};

module.exports = withBundlePackageType;

