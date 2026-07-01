local util = require("forge.util")

local M = {}

function M.list_avds(callback)
    local emulator = util.emulator_path()
    if not emulator then
        callback({}, "Android emulator not found. Set ANDROID_HOME.")
        return
    end
    util.system_text({ emulator, "-list-avds" }, {}, function(result)
        if result.code ~= 0 then
            callback({}, result.stderr)
            return
        end
        local avds = {}
        for line in (result.stdout or ""):gmatch("[^\r\n]+") do
            line = util.trim(line)
            if line ~= "" then
                table.insert(avds, line)
            end
        end
        callback(avds)
    end)
end

function M.list_devices(callback)
    local adb = util.adb_path()
    if not adb then
        callback({}, "adb not found")
        return
    end
    util.system_text({ adb, "devices", "-l" }, {}, function(result)
        local devices = {}
        for line in (result.stdout or ""):gmatch("[^\r\n]+") do
            local serial, state = line:match("^(%S+)%s+(%S+)")
            if serial and state and serial ~= "List" then
                table.insert(devices, { serial = serial, state = state, raw = line })
            end
        end
        callback(devices)
    end)
end

function M.start_emulator(avd_name, callback)
    local emulator = util.emulator_path()
    if not emulator then
        if callback then
            callback(false, "emulator not found")
        end
        return
    end
    vim.notify("Starting emulator " .. avd_name, vim.log.levels.INFO)
    vim.fn.jobstart({ emulator, "-avd", avd_name, "-no-snapshot-load" }, {
        detach = true,
        stdout = "ignore",
        stderr = "ignore",
        stdin = "ignore",
    })
    if callback then
        vim.defer_fn(function()
            callback(true)
        end, 3000)
    end
end

function M.wait_for_emulator(callback, attempts)
    attempts = attempts or 20
    local adb = util.adb_path()
    if not adb then
        callback(nil)
        return
    end
    local function poll(remaining)
        util.system_text({ adb, "devices" }, {}, function(result)
            for line in (result.stdout or ""):gmatch("[^\r\n]+") do
                local serial, state = line:match("^(emulator%-%d+)%s+(%S+)")
                if serial and state == "device" then
                    callback(serial)
                    return
                end
            end
            if remaining > 0 then
                vim.defer_fn(function()
                    poll(remaining - 1)
                end, 1500)
            else
                callback(nil)
            end
        end)
    end
    poll(attempts)
end

function M.with_device(callback)
    M.list_devices(function(devices)
        local ready = vim.tbl_filter(function(d)
            return d.state == "device"
        end, devices)
        if #ready > 0 then
            callback(ready[1].serial)
            return
        end
        M.list_avds(function(avds)
            if #avds == 0 then
                vim.notify("No Android emulators configured", vim.log.levels.ERROR)
                return
            end
            local items = {}
            for _, avd in ipairs(avds) do
                table.insert(items, { label = avd, description = "Start AVD", avd = avd })
            end
            util.pick("Forge — start emulator", items, function(choice)
                if not choice then
                    return
                end
                M.start_emulator(choice.avd, function()
                    M.wait_for_emulator(callback)
                end)
            end)
        end)
    end)
end

function M.menu()
    local items = {
        { label = "Android emulators", description = "List and start AVDs", action = "avds" },
        { label = "Connected devices", description = "List adb devices", action = "devices" },
    }
    util.pick("Forge Devices — Android", items, function(choice)
        if not choice then
            return
        end
        if choice.action == "avds" then
            M.list_avds(function(avds)
                local avd_items = {}
                for _, avd in ipairs(avds) do
                    table.insert(avd_items, {
                        label = avd,
                        description = "Start emulator",
                        avd = avd,
                    })
                end
                util.pick("Forge — Android emulators", avd_items, function(selected)
                    if selected then
                        M.start_emulator(selected.avd)
                    end
                end)
            end)
        elseif choice.action == "devices" then
            M.list_devices(function(devices)
                local lines = { "ADB devices:" }
                for _, device in ipairs(devices) do
                    table.insert(lines, device.raw)
                end
                require("forge.logs").open_output_buffer("Forge — adb devices", lines)
            end)
        end
    end)
end

return M
