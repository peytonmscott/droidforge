local util = require("forge.util")
local gradle = require("forge.gradle")

local M = {}

local WEB_TASKS = {
    "wasmJsBrowserDevelopmentRun",
    "jsBrowserDevelopmentRun",
    "wasmJsBrowserProductionRun",
    "jsBrowserProductionRun",
}

function M.find_web_task(root, tasks)
    local available = {}
    for _, task in ipairs(tasks or {}) do
        available[task.name] = true
        available[task.name:gsub("^:", "")] = true
    end
    for _, base in ipairs(WEB_TASKS) do
        for _, candidate in ipairs({ ":composeApp:" .. base, ":app:" .. base, ":" .. base, base }) do
            if available[candidate] or available[candidate:gsub("^:", "")] then
                return candidate:match("^:") and candidate or (":" .. candidate)
            end
        end
        for name, _ in pairs(available) do
            if name:find(base, 1, true) then
                return name:match("^:") and name or (":" .. name:gsub("^:", ""))
            end
        end
    end
    return nil
end

function M.run_web(root)
    root = root or util.project_root()
    gradle.discover_tasks(root, function(tasks, err)
        if not tasks then
            vim.notify(err or "Could not discover Gradle tasks", vim.log.levels.ERROR)
            return
        end
        local task = M.find_web_task(root, tasks)
        if not task then
            vim.notify("No web browser development task found", vim.log.levels.ERROR)
            return
        end
        gradle.run_task(task, root)
    end)
end

function M.menu()
    M.run_web()
end

return M
