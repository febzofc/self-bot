const fs = require('fs');
const path = require('path');
const syntaxerror = require('syntax-error');

const pluginFolder = path.join(__dirname, '../perintah');
const errorDbPath = path.join(__dirname, '../src/plugin_errors.json');
const disabledDbPath = path.join(__dirname, '../src/disabled_plugins.json');
const pluginFilter = filename => /\.js$/.test(filename);

global.plugins = global.plugins || {};
global.pluginErrors = global.pluginErrors || {};
global.pluginFailures = global.pluginFailures || {};
global.disabledPlugins = global.disabledPlugins || {};

/**
 * Loads persisted plugin errors and failures from JSON database
 */
function loadErrorDatabase() {
    try {
        const srcDir = path.join(__dirname, '../src');
        if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

        if (fs.existsSync(errorDbPath)) {
            const raw = fs.readFileSync(errorDbPath, 'utf8');
            const data = JSON.parse(raw);
            global.pluginErrors = data.pluginErrors || {};
            global.pluginFailures = data.pluginFailures || {};
        } else {
            global.pluginErrors = global.pluginErrors || {};
            global.pluginFailures = global.pluginFailures || {};
            saveErrorDatabase();
        }
    } catch (e) {
        console.error('Error loading plugin error database:', e);
        global.pluginErrors = global.pluginErrors || {};
        global.pluginFailures = global.pluginFailures || {};
    }
}

/**
 * Saves current plugin errors and failure counts to JSON database
 */
function saveErrorDatabase() {
    try {
        const srcDir = path.join(__dirname, '../src');
        if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

        const data = {
            pluginErrors: global.pluginErrors || {},
            pluginFailures: global.pluginFailures || {}
        };
        fs.writeFileSync(errorDbPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving plugin error database:', e);
    }
}

/**
 * Loads persisted disabled plugins list
 */
function loadDisabledDatabase() {
    try {
        const srcDir = path.join(__dirname, '../src');
        if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

        if (fs.existsSync(disabledDbPath)) {
            const raw = fs.readFileSync(disabledDbPath, 'utf8');
            global.disabledPlugins = JSON.parse(raw) || {};
        } else {
            global.disabledPlugins = global.disabledPlugins || {};
            saveDisabledDatabase();
        }
    } catch (e) {
        console.error('Error loading disabled plugins database:', e);
        global.disabledPlugins = global.disabledPlugins || {};
    }
}

/**
 * Saves current disabled plugins list
 */
function saveDisabledDatabase() {
    try {
        const srcDir = path.join(__dirname, '../src');
        if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

        fs.writeFileSync(disabledDbPath, JSON.stringify(global.disabledPlugins || {}, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving disabled plugins database:', e);
    }
}

/**
 * Gets code content of a plugin file
 */
function getPluginCode(filename) {
    const filePath = path.join(pluginFolder, filename);
    if (!fs.existsSync(filePath)) {
        throw new Error(`File ${filename} tidak ditemukan.`);
    }
    return fs.readFileSync(filePath, 'utf8');
}

/**
 * Saves code content to a plugin file and reloads it
 */
function savePluginCode(filename, codeContent) {
    const filePath = path.join(pluginFolder, filename);
    fs.writeFileSync(filePath, codeContent, 'utf8');
    delete global.pluginErrors[filename];
    global.pluginFailures[filename] = 0;
    saveErrorDatabase();
    return reloadPlugin(filename, true);
}

/**
 * Creates a new plugin file and loads it
 */
function createPlugin(filename, codeContent) {
    let cleanName = path.basename(filename).trim();
    if (!cleanName.endsWith('.js')) cleanName += '.js';
    
    if (!/^[a-zA-Z0-9_-]+\.js$/.test(cleanName)) {
        throw new Error('Nama file plugin tidak valid. Gunakan huruf, angka, underscore, atau dash.');
    }

    const filePath = path.join(pluginFolder, cleanName);
    if (fs.existsSync(filePath)) {
        throw new Error(`Plugin dengan nama '${cleanName}' sudah ada.`);
    }

    fs.writeFileSync(filePath, codeContent, 'utf8');
    delete global.pluginErrors[cleanName];
    delete global.disabledPlugins[cleanName];
    global.pluginFailures[cleanName] = 0;
    saveErrorDatabase();
    saveDisabledDatabase();

    const reloadRes = reloadPlugin(cleanName, true);
    return { success: true, filename: cleanName, reloadRes };
}

/**
 * Disables a plugin
 */
function disablePlugin(filename) {
    global.disabledPlugins[filename] = true;
    delete global.plugins[filename];
    saveDisabledDatabase();
    console.log(`⏸️ [Plugin Disabled] '${filename}' has been disabled by owner.`);
    return { success: true, filename, stats: getStats() };
}

/**
 * Enables a plugin
 */
function enablePlugin(filename) {
    delete global.disabledPlugins[filename];
    saveDisabledDatabase();
    console.log(`▶️ [Plugin Enabled] '${filename}' has been enabled by owner.`);
    const result = reloadPlugin(filename, true);
    return { success: true, filename, result, stats: getStats() };
}

/**
 * Single plugin loader with syntax & structure validation and DB persistence
 */
function loadSinglePlugin(filename, force = false) {
    const filePath = path.join(pluginFolder, filename);
    if (!fs.existsSync(filePath)) {
        delete global.plugins[filename];
        delete global.pluginErrors[filename];
        delete global.pluginFailures[filename];
        delete global.disabledPlugins[filename];
        saveErrorDatabase();
        saveDisabledDatabase();
        return { success: false, reason: 'File deleted' };
    }

    // Check if plugin is manually disabled
    if (!force && global.disabledPlugins[filename]) {
        delete global.plugins[filename];
        return { success: false, disabled: true, reason: 'Plugin nonaktif' };
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');

    // If already marked as errored and code hasn't changed and not forced, keep errored state
    if (!force && global.pluginErrors[filename]) {
        const existingErr = global.pluginErrors[filename];
        if (existingErr.codeSnippet === fileContent) {
            delete global.plugins[filename];
            return { success: false, error: existingErr };
        }
    }

    const err = syntaxerror(fileContent, filename);

    if (err) {
        const errorDetail = {
            filename,
            errorType: 'SYNTAX_ERROR',
            errorMessage: err.message || String(err),
            stackTrace: String(err),
            lastErrorTime: new Date().toLocaleString('id-ID'),
            codeSnippet: fileContent
        };
        global.pluginErrors[filename] = errorDetail;
        delete global.plugins[filename];
        saveErrorDatabase();
        console.error(`❌ [Plugin Load Error] Syntax error in ${filename}:\n${err}`);
        return { success: false, error: errorDetail };
    }

    try {
        // Clear Node.js require cache properly for both canonical and relative paths
        try {
            const resolvedPath = require.resolve(filePath);
            if (resolvedPath in require.cache) {
                delete require.cache[resolvedPath];
            }
        } catch (e) {}

        if (filePath in require.cache) {
            delete require.cache[filePath];
        }

        const pluginMod = require(filePath);

        // Basic structural checks
        if (typeof pluginMod !== 'object' || pluginMod === null) {
            throw new Error(`Plugin '${filename}' harus meng-export object.`);
        }
        if (typeof pluginMod.exec !== 'function') {
            throw new Error(`Plugin '${filename}' tidak memiliki fungsi 'exec'.`);
        }
        if (!pluginMod.CmD && !pluginMod.aliases) {
            throw new Error(`Plugin '${filename}' tidak memiliki properti 'CmD' atau 'aliases'.`);
        }

        global.plugins[filename] = pluginMod;
        delete global.pluginErrors[filename];
        global.pluginFailures[filename] = 0;
        saveErrorDatabase();
        console.log(`✅ [Plugin Loaded] '${filename}'`);
        return { success: true, plugin: pluginMod };

    } catch (e) {
        const errorDetail = {
            filename,
            errorType: 'LOAD_ERROR',
            errorMessage: e.message || String(e),
            stackTrace: e.stack || String(e),
            lastErrorTime: new Date().toLocaleString('id-ID'),
            codeSnippet: fileContent
        };
        global.pluginErrors[filename] = errorDetail;
        delete global.plugins[filename];
        saveErrorDatabase();
        console.error(`❌ [Plugin Load Error] Failed to require '${filename}':`, e);
        return { success: false, error: errorDetail };
    }
}

/**
 * Loads all plugins in the plugin directory
 */
function loadAllPlugins() {
    if (!fs.existsSync(pluginFolder)) {
        fs.mkdirSync(pluginFolder, { recursive: true });
    }

    // Load persisted databases
    loadErrorDatabase();
    loadDisabledDatabase();

    const files = fs.readdirSync(pluginFolder).filter(pluginFilter);
    global.plugins = {};

    // Clean up error & disabled entries for files that no longer exist on disk
    for (let errFile in global.pluginErrors) {
        if (!files.includes(errFile)) {
            delete global.pluginErrors[errFile];
            delete global.pluginFailures[errFile];
        }
    }
    for (let disFile in global.disabledPlugins) {
        if (!files.includes(disFile)) {
            delete global.disabledPlugins[disFile];
        }
    }
    saveErrorDatabase();
    saveDisabledDatabase();

    for (let filename of files) {
        loadSinglePlugin(filename, false);
    }

    // Sort active plugins alphabetically
    global.plugins = Object.fromEntries(
        Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b))
    );

    console.log(`\n📦 Total Plugins Loaded: ${Object.keys(global.plugins).length} active, ${Object.keys(global.pluginErrors).length} errored, ${Object.keys(global.disabledPlugins).length} disabled.\n`);
    return getStats();
}

/**
 * Hot-reloads a single plugin
 */
function reloadPlugin(filename, force = true) {
    if (!pluginFilter(filename)) return null;
    const result = loadSinglePlugin(filename, force);
    global.plugins = Object.fromEntries(
        Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b))
    );
    return result;
}

/**
 * Resets failure count when plugin executes successfully
 */
function handleExecutionSuccess(filename) {
    if (global.pluginFailures[filename] && global.pluginFailures[filename] > 0) {
        console.log(`✨ [Plugin Recovery] '${filename}' executed successfully. Resetting consecutive failure count from ${global.pluginFailures[filename]} to 0.`);
        global.pluginFailures[filename] = 0;
        saveErrorDatabase();
    }
}

/**
 * Handles execution errors during plugin run.
 * Only confirms a plugin as errored if it fails 5 times consecutively.
 */
function handleExecutionError(filename, err, context = {}) {
    const filePath = path.join(pluginFolder, filename);
    let fileContent = '';
    try {
        if (fs.existsSync(filePath)) fileContent = fs.readFileSync(filePath, 'utf8');
    } catch (_) {}

    const errStr = String(err);
    const errStack = err?.stack || errStr;

    global.pluginFailures[filename] = (global.pluginFailures[filename] || 0) + 1;
    const currentFailures = global.pluginFailures[filename];
    const MAX_CONSECUTIVE_ERRORS = 5;

    if (currentFailures >= MAX_CONSECUTIVE_ERRORS) {
        const isCodeError = err instanceof TypeError || 
                            err instanceof ReferenceError || 
                            err instanceof SyntaxError || 
                            err instanceof RangeError ||
                            /is not a function|cannot read propert|is not defined|unexpected token|invalid url/i.test(errStr);

        const errorDetail = {
            filename,
            errorType: isCodeError ? 'RUNTIME_CODE_ERROR' : 'PERSISTENT_FETCH_ERROR',
            errorMessage: err?.message || errStr,
            stackTrace: errStack,
            lastErrorTime: new Date().toLocaleString('id-ID'),
            failuresCount: currentFailures,
            commandTriggered: context.command || 'unknown',
            codeSnippet: fileContent
        };

        global.pluginErrors[filename] = errorDetail;
        delete global.plugins[filename];
        saveErrorDatabase();
        console.error(`🛑 [Plugin Disabled] '${filename}' failed 5 consecutive times and has been moved to pluginErrors:\n${errStack}`);
        return { isRealError: true, failuresCount: currentFailures, errorDetail };
    } else {
        saveErrorDatabase();
        console.warn(`⚠️ [Plugin Warning] '${filename}' failed (Attempt ${currentFailures}/${MAX_CONSECUTIVE_ERRORS} consecutive failures). Error count will reset if next run succeeds.`);
        return { isRealError: false, failuresCount: currentFailures, error: errStr };
    }
}

/**
 * Resets error state for a plugin and reloads it
 */
function resetPluginError(filename) {
    delete global.pluginErrors[filename];
    global.pluginFailures[filename] = 0;
    saveErrorDatabase();
    return reloadPlugin(filename, true);
}

/**
 * Returns overall statistics and lists
 */
function getStats() {
    const allFiles = fs.existsSync(pluginFolder) 
        ? fs.readdirSync(pluginFolder).filter(pluginFilter) 
        : [];
    
    return {
        totalPlugins: allFiles.length,
        activeCount: Object.keys(global.plugins).length,
        erroredCount: Object.keys(global.pluginErrors).length,
        disabledCount: Object.keys(global.disabledPlugins).length,
        activePlugins: Object.keys(global.plugins),
        erroredPlugins: global.pluginErrors,
        disabledPlugins: global.disabledPlugins
    };
}

module.exports = {
    pluginFolder,
    pluginFilter,
    loadAllPlugins,
    reloadPlugin,
    loadSinglePlugin,
    handleExecutionSuccess,
    handleExecutionError,
    resetPluginError,
    getPluginCode,
    savePluginCode,
    createPlugin,
    disablePlugin,
    enablePlugin,
    getStats
};
