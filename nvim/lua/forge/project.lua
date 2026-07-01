local util = require("forge.util")

local M = {}

local ANDROID_PLUGINS = {
    "com.android.application",
    "com.android.library",
    "com.android.dynamic-feature",
}

function M.find_gradle_root(start_dir)
    local current = vim.fn.fnamemodify(start_dir or vim.fn.getcwd(), ":p")
    while true do
        if util.file_exists(util.path_join(current, "settings.gradle"))
            or util.file_exists(util.path_join(current, "settings.gradle.kts")) then
            return current
        end
        local parent = vim.fn.fnamemodify(current, ":h")
        if parent == current then
            return nil
        end
        current = parent
    end
end

function M.gradle_text(root)
    local text = ""
    for _, file in ipairs(util.gradle_files(root)) do
        text = text .. "\n" .. util.read_file(file)
    end
    local catalog = util.path_join(root, "gradle/libs.versions.toml")
    if util.file_exists(catalog) then
        text = text .. "\n" .. util.read_file(catalog)
    end
    return text
end

function M.has_android_plugin(root)
    local text = M.gradle_text(root)
    for _, plugin in ipairs(ANDROID_PLUGINS) do
        if text:find(plugin, 1, true) then
            return true
        end
    end
    if text:find("alias(libs.plugins.android.application)") then
        return true
    end
    if text:find("alias(libs.plugins.android.library)") then
        return true
    end
    return false
end

function M.is_kmp_project(root)
    local text = M.gradle_text(root)
    return text:find('kotlin("multiplatform")', 1, true)
        or text:find("org.jetbrains.kotlin.multiplatform", 1, true)
        or text:find("kotlin-multiplatform", 1, true)
end

function M.has_ios_target(root)
    local text = M.gradle_text(root)
    return text:find('ios()', 1, true)
        or text:find("org.jetbrains.kotlin.native.cocoapods", 1, true)
        or util.file_exists(util.path_join(root, "iosApp"))
        or #vim.fn.globpath(root, "iosApp/*.xcodeproj", false, true) > 0
        or #vim.fn.globpath(root, "iosApp/*.xcworkspace", false, true) > 0
end

function M.has_web_target(root)
    local text = M.gradle_text(root)
    return text:find("wasmJs", 1, true)
        or text:find("js(", 1, true)
        or text:find("js {", 1, true)
        or text:find("browser()", 1, true)
end

function M.is_android_app(root)
    return util.file_exists(util.path_join(root, "gradlew")) and M.has_android_plugin(root)
end

function M.buffer_source_set()
    local path = vim.api.nvim_buf_get_name(0)
    if path:find("androidMain", 1, true) or path:find("/android/", 1, true) then
        return "android"
    end
    if path:find("iosMain", 1, true) or path:find("appleMain", 1, true) or path:find("/iosApp/", 1, true) then
        return "ios"
    end
    if path:find("jvmMain", 1, true) or path:find("desktopMain", 1, true) then
        return "jvm"
    end
    if path:find("wasmJs", 1, true) or path:find("jsMain", 1, true) or path:find("webMain", 1, true) then
        return "web"
    end
    if vim.bo.filetype == "swift" then
        return "ios"
    end
    return "common"
end

function M.application_id(root)
    for _, file in ipairs(util.gradle_files(root)) do
        local content = util.read_file(file)
        local id = content:match('applicationId%s*=%s*"([^"]+)"')
            or content:match('namespace%s*=%s*"([^"]+)"')
        if id then
            return id
        end
    end
    return nil
end

function M.ios_app_dir(root)
    if util.file_exists(util.path_join(root, "iosApp")) then
        return util.path_join(root, "iosApp")
    end
    local projects = vim.fn.globpath(root, "iosApp/*.xcodeproj", false, true)
    if #projects > 0 then
        return util.path_join(root, "iosApp")
    end
    return nil
end

function M.detect(root)
    root = root or util.project_root()
    return {
        root = root,
        is_gradle = util.file_exists(util.path_join(root, "gradlew")),
        is_android = M.is_android_app(root),
        is_kmp = M.is_kmp_project(root),
        has_ios = M.has_ios_target(root),
        has_web = M.has_web_target(root),
        application_id = M.application_id(root),
        source_set = M.buffer_source_set(),
    }
end

return M
