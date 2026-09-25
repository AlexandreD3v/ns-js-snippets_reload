const path = require('path');

let cachedData = null;

function loadData(extensionPath) {
    if (cachedData) {
        return cachedData;
    }

    const dataDir = path.join(extensionPath, 'data');

    cachedData = {
        modules: require(path.join(dataDir, 'modules.json')),
        annotations: require(path.join(dataDir, 'annotations.json')),
        entryPoints: require(path.join(dataDir, 'entryPoints.json')),
        enums: require(path.join(dataDir, 'enums.json'))
    };

    return cachedData;
}

module.exports = {
    loadData
};
