/**
 * Script to validate styling in Gaslands Garage
 * 
 * This script provides a checklist of styling and UI requirements for
 * the application, serving as a validation tool for UI changes.
 */

const styleValidationList = [
    {
        id: "header-cost-badge",
        description: "Vehicle cost badge in the header",
        requirements: [
            "Should display cost in cans",
            "Should have amber (amber-600) background",
            "Should have white text",
            "Should have rounded corners",
            "Should have consistent styling between light and dark modes"
        ]
    },
    {
        id: "header-slots-badge",
        description: "Build slots badge in the header",
        requirements: [
            "Should display used and max slots (e.g., 1/2)",
            "Should have blue (blue-600) background",
            "Should have white text",
            "Should have rounded corners",
            "Should have consistent styling between light and dark modes"
        ]
    },
    {
        id: "build-header-component",
        description: "BuildHeader component UI",
        requirements: [
            "Should encapsulate both vehicle cost and build slots badges",
            "Should be reusable across normal and collapsed vehicle views",
            "Should have proper spacing between badges",
            "Should update correctly when vehicle configuration changes"
        ]
    },
    {
        id: "collapsed-vehicle-view",
        description: "Collapsed vehicle view styling",
        requirements: [
            "Should show BuildHeader component",
            "Should maintain proper layout with other vehicle info",
            "Should fit properly in the container",
            "Should have consistent styling between light and dark modes"
        ]
    },
    {
        id: "expanded-vehicle-view",
        description: "Expanded vehicle view styling",
        requirements: [
            "Should show BuildHeader component in the top section",
            "Should have proper spacing relative to other controls",
            "Should be properly aligned in the container",
            "Should have consistent styling between light and dark modes"
        ]
    }
];

// Generate checklist output in the console
function generateStyleChecklist() {
    console.log("Gaslands Garage UI Style Validation Checklist");
    console.log("==============================================");
    console.log("");
    
    styleValidationList.forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.description}`);
        item.requirements.forEach((req, reqIdx) => {
            console.log(`   ${String.fromCharCode(97 + reqIdx)}. [ ] ${req}`);
        });
        console.log("");
    });
    
    console.log("Instructions:");
    console.log("1. Manually check each item in the browser");
    console.log("2. Verify that all requirements are met");
    console.log("3. Test in both light and dark modes");
    console.log("4. Test with various vehicle configurations");
}

generateStyleChecklist();