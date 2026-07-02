local util = require("forge.util")
local logs = require("forge.logs")

local M = {}

function M.available()
    return util.is_macos() and util.executable("xcrun")
end

function M.list_simulators(callback)
    if not M.available() then
        callback({}, "iOS tooling requires macOS with Xcode")
        return
    end
    util.system_text({ "xcrun", "simctl", "list", "devices", "available" }, {}, function(result)
        local sims = {}
        local current_os
        for line in (result.stdout or ""):gmatch("[^\r\n]+") do
            local os_line = line:match("^%-%- ([%w%s%p]+) %-%-$")
            if os_line then
                current_os = os_line
            end
            local name, id, state = line:match("%s*(.+)%s+%(([%w%-]+)%)%s+%(([^)]+)%)$")
            if name and id then
                table.insert(sims, {
                    name = util.trim(name),
                    id = id,
                    state = state,
                    os = current_os,
                })
            end
        end
        callback(sims)
    end)
end

function M.boot_simulator(id, callback)
    util.system_text({ "xcrun", "simctl", "boot", id }, {}, function(result)
        if result.code ~= 0 and not (result.stderr or ""):find("current state: Booted") then
            if callback then
                callback(false, result.stderr)
            end
            return
        end
        util.system_text({ "open", "-a", "Simulator" }, {}, function()
            if callback then
                callback(true)
            end
        end)
    end)
end

function M.xcodebuild_list(ios_dir, callback)
    local workspace = vim.fn.globpath(ios_dir, "*.xcworkspace", false, true)[1]
    local project = vim.fn.globpath(ios_dir, "*.xcodeproj", false, true)[1]
    local args = { "xcodebuild", "-list" }
    if workspace then
        vim.list_extend(args, { "-workspace", workspace })
    elseif project then
        vim.list_extend(args, { "-project", project })
    else
        callback(nil, "No Xcode project in iosApp")
        return
    end
    util.system_text(args, { cwd = ios_dir }, function(result)
        if result.code ~= 0 then
            callback(nil, result.stderr)
            return
        end
        local schemes = {}
        local in_schemes = false
        for line in (result.stdout or ""):gmatch("[^\r\n]+") do
            if line:find("Schemes:") then
                in_schemes = true
            elseif in_schemes then
                local scheme = util.trim(line)
                if scheme ~= "" then
                    table.insert(schemes, scheme)
                end
            end
        end
        callback({ schemes = schemes, workspace = workspace, project = project })
    end)
end

function M.run_ios(root, scheme)
    if not M.available() then
        vim.notify("iOS run requires macOS with Xcode", vim.log.levels.ERROR)
        return
    end
    root = root or util.project_root()
    local ios_dir = require("forge.project").ios_app_dir(root)
    if not ios_dir then
        vim.notify("No iosApp directory found", vim.log.levels.ERROR)
        return
    end

    M.xcodebuild_list(ios_dir, function(info, err)
        if not info then
            vim.notify(err or "Could not read Xcode schemes", vim.log.levels.ERROR)
            return
        end
        local chosen = scheme
        if not chosen then
            chosen = info.schemes[1]
        end
        if not chosen then
            vim.notify("No Xcode schemes found", vim.log.levels.ERROR)
            return
        end

        M.list_simulators(function(sims)
            local booted = vim.tbl_filter(function(s)
                return s.state == "Booted"
            end, sims)
            local function build_and_run(sim_id)
                local args = { "xcodebuild" }
                if info.workspace then
                    vim.list_extend(args, { "-workspace", vim.fn.shellescape(info.workspace) })
                else
                    vim.list_extend(args, { "-project", vim.fn.shellescape(info.project) })
                end
                -- Target the actual simulator instead of assuming a model name.
                local destination = sim_id and ("id=" .. sim_id) or "generic/platform=iOS Simulator"
                vim.list_extend(args, {
                    "-scheme",
                    vim.fn.shellescape(chosen),
                    "-destination",
                    vim.fn.shellescape(destination),
                    "build",
                })
                local cmd = table.concat(args, " ")
                logs.run_with_output("Forge iOS — " .. chosen, cmd, ios_dir)
            end
            if #booted > 0 then
                build_and_run(booted[1].id)
            elseif #sims > 0 then
                M.boot_simulator(sims[1].id, function()
                    build_and_run(sims[1].id)
                end)
            else
                build_and_run(nil)
            end
        end)
    end)
end

function M.menu()
    if not M.available() then
        vim.notify("iOS simulator menu requires macOS with Xcode", vim.log.levels.WARN)
        return
    end
    local items = {
        { label = "Simulators", description = "Boot iOS simulator", action = "sims" },
        { label = "Run iosApp", description = "xcodebuild selected scheme", action = "run" },
    }
    util.pick("Forge Devices — iOS", items, function(choice)
        if not choice then
            return
        end
        if choice.action == "sims" then
            M.list_simulators(function(sims)
                local sim_items = {}
                for _, sim in ipairs(sims) do
                    table.insert(sim_items, {
                        label = sim.name,
                        description = (sim.os or "") .. " — " .. sim.state,
                        id = sim.id,
                    })
                end
                util.pick("Forge — iOS simulators", sim_items, function(selected)
                    if selected then
                        M.boot_simulator(selected.id)
                    end
                end)
            end)
        elseif choice.action == "run" then
            M.run_ios(util.project_root())
        end
    end)
end

return M
