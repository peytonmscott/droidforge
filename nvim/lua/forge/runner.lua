local util = require("forge.util")
local project = require("forge.project")
local logs = require("forge.logs")
local gradle = require("forge.gradle")
local android = require("forge.android")
local ios = require("forge.ios")
local web = require("forge.web")

local M = {}

local run_command_cache = {}

local function path_join(...)
    return util.path_join(...)
end

local function file_exists(path)
    return util.file_exists(path)
end

local function read_file(path)
    return util.read_file(path)
end

local function gradle_files(root)
    return util.gradle_files(root)
end

local function is_android_project(root)
    return project.is_android_app(root)
end

local function parse_running_emulator(adb_devices_output)
    for line in adb_devices_output:gmatch("[^\r\n]+") do
        local serial, state = line:match("^(emulator%-%d+)%s+(%S+)")
        if serial and state == "device" then
            return serial
        end
    end
end

local function newest_file(paths)
    local newest
    local newest_time = -1
    for _, filepath in ipairs(paths) do
        local time = vim.fn.getftime(filepath)
        if time > newest_time then
            newest = filepath
            newest_time = time
        end
    end
    return newest
end

local function find_debug_apk(root)
    local patterns = {
        "*/build/outputs/apk/debug/*.apk",
        "*/build/outputs/apk/*debug*/*.apk",
        "**/build/outputs/apk/debug/*.apk",
    }
    for _, pattern in ipairs(patterns) do
        local apks = vim.fn.globpath(root, pattern, false, true)
        if #apks > 0 then
            return newest_file(apks)
        end
    end
end

local function deploy_android(root, serial, apk)
    vim.notify("Deploying " .. vim.fn.fnamemodify(apk, ":t") .. " to " .. serial, vim.log.levels.INFO)
    local adb = util.adb_path()
    if not adb then
        return
    end
    util.system_text({ adb, "-s", serial, "install", "-r", apk }, { cwd = root }, function(result)
        if result.code ~= 0 then
            vim.notify(result.stderr ~= "" and result.stderr or result.stdout, vim.log.levels.ERROR)
            return
        end
        vim.notify("Android app installed", vim.log.levels.INFO)
        logs.open_logcat({ package = project.application_id(root) })
    end)
end

local function run_android_install(root)
    gradle.discover_tasks(root, function(tasks)
        local task = gradle.curated_options(root, tasks or {})
        local install_task = ":app:installDebug"
        for _, item in ipairs(task) do
            if item.task and item.task:find("installDebug") then
                install_task = item.task
                break
            end
        end
        logs.run_with_output("Forge Run — Android", "./gradlew " .. install_task .. " --console=plain", root, function(code)
            if code ~= 0 then
                return
            end
            android.with_device(function(serial)
                local apk = find_debug_apk(root)
                if apk then
                    deploy_android(root, serial, apk)
                else
                    vim.notify("installDebug finished but no APK found", vim.log.levels.WARN)
                    logs.open_logcat({ package = project.application_id(root) })
                end
            end)
        end)
    end)
end

local function run_android_assemble(root)
    logs.run_with_output("Forge Run — Android", "./gradlew assembleDebug --console=plain", root, function(code)
        if code ~= 0 then
            return
        end
        android.with_device(function(serial)
            local apk = find_debug_apk(root)
            if apk then
                deploy_android(root, serial, apk)
            end
        end)
    end)
end

local function package_script(root)
    local package_json = path_join(root, "package.json")
    if not file_exists(package_json) then
        return nil
    end
    local ok, decoded = pcall(vim.json.decode, read_file(package_json))
    if not ok or type(decoded) ~= "table" or type(decoded.scripts) ~= "table" then
        return nil
    end
    for _, script in ipairs({ "dev", "start", "test" }) do
        if decoded.scripts[script] then
            return "npm run " .. script
        end
    end
end

local function file_runner()
    local file = vim.api.nvim_buf_get_name(0)
    if file == "" then
        return nil
    end
    local escaped_file = vim.fn.shellescape(file)
    local ft = vim.bo.filetype
    local runners = {
        lua = "lua " .. escaped_file,
        python = "python3 " .. escaped_file,
        javascript = "node " .. escaped_file,
        sh = "bash " .. escaped_file,
        go = "go run " .. escaped_file,
    }
    if ft == "typescript" then
        return util.executable("tsx") and ("tsx " .. escaped_file) or nil
    end
    return runners[ft]
end

local function command_for_root(root)
    if file_exists(path_join(root, "package.json")) then
        local script = package_script(root)
        if script then
            return script
        end
    end
    if file_exists(path_join(root, "Cargo.toml")) then
        return "cargo run"
    end
    if file_exists(path_join(root, "go.mod")) then
        return "go run ./..."
    end
    if file_exists(path_join(root, "gradlew")) then
        local gradle_text = project.gradle_text(root)
        if gradle_text:find("application", 1, true) then
            return "./gradlew run"
        end
        return "./gradlew build"
    end
    return file_runner()
end

function M.run_target(target)
    local root = util.project_root()
    local info = project.detect(root)
    if target == "web" or (not target and info.source_set == "web") then
        web.run_web(root)
        return
    end
    if target == "android" or (not target and info.source_set == "android") then
        run_android_install(root)
        return
    end
    if target == "ios" or (not target and info.source_set == "ios") then
        ios.run_ios(root)
        return
    end
    if target == "jvm" or (not target and info.source_set == "jvm") then
        logs.run_with_output("Forge Run — JVM", "./gradlew run --console=plain", root)
        return
    end
    M.smart_run()
end

function M.run_menu()
    local info = project.detect()
    local items = {
        { label = "Android", description = "installDebug + app logs", target = "android" },
        { label = "iOS", description = "xcodebuild iosApp", target = "ios" },
        { label = "Web", description = "wasm/js browser dev server", target = "web" },
        { label = "JVM / Desktop", description = "./gradlew run", target = "jvm" },
        { label = "Smart run", description = "Context-aware fallback", target = "smart" },
    }
    if not info.has_ios then
        items = vim.tbl_filter(function(i)
            return i.target ~= "ios"
        end, items)
    end
    if not info.has_web then
        items = vim.tbl_filter(function(i)
            return i.target ~= "web"
        end, items)
    end
    util.pick("Forge Run", items, function(choice)
        if not choice then
            return
        end
        if choice.target == "smart" then
            M.smart_run()
        else
            M.run_target(choice.target)
        end
    end)
end

function M.smart_run()
    local root = util.project_root()
    local info = project.detect(root)

    if info.source_set == "web" and info.has_web then
        web.run_web(root)
        return
    end
    if info.source_set == "ios" and info.has_ios then
        ios.run_ios(root)
        return
    end
    if info.source_set == "android" or is_android_project(root) then
        run_android_install(root)
        return
    end
    if info.source_set == "jvm" then
        logs.run_with_output("Forge Run — JVM", "./gradlew run --console=plain", root)
        return
    end

    if is_android_project(root) then
        run_android_assemble(root)
        return
    end

    local command = run_command_cache[root] or command_for_root(root)
    if command then
        run_command_cache[root] = command
        logs.run_with_output("Forge Run", command, root)
        return
    end

    M.run_menu()
end

function M.setup()
    vim.keymap.set("n", "<leader>r", M.smart_run, { desc = "Forge run" })
end

return M
