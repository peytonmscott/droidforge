local util = require("forge.util")

local M = {}

local function status_line(ok, label, detail)
    local icon = ok and "✓" or "✗"
    return string.format("%s %s%s", icon, label, detail and (": " .. detail) or "")
end

local function check_executable(name, path_fn)
    if path_fn then
        local path = path_fn()
        return path ~= nil, path
    end
    return util.executable(name), name
end

function M.checks()
    local lines = { "Forge Doctor", "" }
    local neovim_version = vim.version()
    table.insert(lines, status_line(neovim_version.major >= 0, "Neovim", tostring(neovim_version)))

    local kotlin_dir = os.getenv("KOTLIN_LSP_DIR")
        or (util.file_exists("/opt/homebrew/opt/kotlin-lsp/libexec") and "/opt/homebrew/opt/kotlin-lsp/libexec" or nil)
    table.insert(lines, status_line(kotlin_dir ~= nil, "kotlin-lsp", kotlin_dir or "not found"))

    local kotlin_ok = pcall(require, "kotlin")
    table.insert(lines, status_line(kotlin_ok, "kotlin.nvim"))

    local jdtls_ok = util.executable("jdtls")
    table.insert(lines, status_line(jdtls_ok, "jdtls"))

    if util.is_macos() then
        local xcode = util.system_sync({ "xcode-select", "-p" })
        table.insert(lines, status_line(xcode.code == 0, "Xcode", xcode.stdout and util.trim(xcode.stdout) or nil))
        local sk = util.system_sync({ "xcrun", "--find", "sourcekit-lsp" })
        table.insert(lines, status_line(sk.code == 0, "sourcekit-lsp", sk.stdout and util.trim(sk.stdout) or nil))
    else
        table.insert(lines, "· iOS/Swift checks skipped (not macOS)")
    end

    local android_home = os.getenv("ANDROID_HOME") or os.getenv("ANDROID_SDK_ROOT")
    table.insert(lines, status_line(android_home ~= nil, "ANDROID_HOME", android_home))

    local adb_ok, adb_path = check_executable("adb", util.adb_path)
    table.insert(lines, status_line(adb_ok, "adb", adb_path))

    local emulator_ok, emulator_path = check_executable("emulator", util.emulator_path)
    table.insert(lines, status_line(emulator_ok, "emulator", emulator_path))

    local java = util.system_sync({ "java", "-version" })
    table.insert(lines, status_line(java.code == 0, "java"))

    local gradle_wrapper = util.file_exists(util.path_join(util.project_root(), "gradlew"))
    table.insert(lines, status_line(gradle_wrapper, "gradlew in project"))

    local info = require("forge.project").detect()
    table.insert(lines, "")
    table.insert(lines, "Project detection:")
    table.insert(lines, status_line(info.is_gradle, "Gradle project", info.root))
    table.insert(lines, status_line(info.is_kmp, "Kotlin Multiplatform"))
    table.insert(lines, status_line(info.is_android, "Android app"))
    table.insert(lines, status_line(info.has_ios, "iOS target"))
    table.insert(lines, status_line(info.has_web, "Web target"))
    if info.application_id then
        table.insert(lines, "  applicationId: " .. info.application_id)
    end

    return lines
end

function M.run()
    local lines = M.checks()
    require("forge.logs").open_output_buffer("Forge Doctor", lines, { height = 24 })
end

return M
