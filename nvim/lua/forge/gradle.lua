local util = require("forge.util")
local logs = require("forge.logs")

local M = {}

local CURATED = {
    { base = "assembleDebug", label = "Assemble Debug", description = "Builds the debug APK/AAB" },
    { base = "installDebug", label = "Install Debug", description = "Installs debug build on device" },
    { base = "test", label = "Unit Tests", description = "Runs JVM unit tests" },
    { base = "connectedAndroidTest", label = "Instrumented Tests", description = "Runs connected Android tests" },
    { base = "lint", label = "Lint", description = "Runs Android lint checks" },
    { base = "check", label = "Check", description = "Runs verification tasks" },
    { base = "build", label = "Build", description = "Builds the project" },
    { base = "clean", label = "Clean", description = "Cleans build outputs" },
    { base = "assembleRelease", label = "Assemble Release", description = "Builds release APK/AAB" },
}

local KMP_CURATED = {
    { base = "wasmJsBrowserDevelopmentRun", label = "Web Dev Server", description = "Run wasm/js browser dev server" },
    { base = "jsBrowserDevelopmentRun", label = "JS Browser Dev", description = "Run JS browser development" },
    { base = "embedAndSignAppleFrameworkForXcode", label = "Embed iOS Framework", description = "Prepare Apple framework for Xcode" },
    { base = "podInstall", label = "Pod Install", description = "Install CocoaPods dependencies" },
}

local task_cache = {}

local function normalize_task_name(name)
    local trimmed = util.trim(name)
    if trimmed:find(":") and not trimmed:find("^:") then
        return ":" .. trimmed
    end
    return trimmed
end

function M.parse_tasks(output)
    local tasks = {}
    local seen = {}
    for line in output:gmatch("[^\r\n]+") do
        local name, description = line:match("^([%w:_%-]+)%s+%-%s+(.+)$")
        if name then
            local normalized = normalize_task_name(name)
            if normalized ~= "" and not seen[normalized] then
                seen[normalized] = true
                table.insert(tasks, { name = normalized, description = util.trim(description) })
            end
        end
    end
    table.sort(tasks, function(a, b)
        return a.name < b.name
    end)
    return tasks
end

function M.discover_tasks(root, callback)
    root = root or util.project_root()
    if task_cache[root] then
        callback(task_cache[root])
        return
    end
  if not util.file_exists(util.path_join(root, "gradlew")) then
    callback(nil, "No Gradle wrapper found")
    return
  end
    util.system_text({ "./gradlew", "tasks", "--all", "--console=plain" }, { cwd = root }, function(result)
        if result.code ~= 0 then
            callback(nil, (result.stderr ~= "" and result.stderr or result.stdout) or "Gradle task discovery failed")
            return
        end
        local tasks = M.parse_tasks(result.stdout or "")
        task_cache[root] = tasks
        callback(tasks)
    end)
end

local function resolve_task(base, tasks)
    local names = {}
    for _, task in ipairs(tasks) do
        names[task.name] = task
    end
    local candidates = {
        ":app:" .. base,
        "app:" .. base,
        base,
        ":" .. base,
    }
    for _, name in ipairs(candidates) do
        if names[name] then
            return name
        end
        local normalized = normalize_task_name(name)
        if names[normalized] then
            return normalized
        end
    end
    -- Fall back to a module-qualified task (e.g. :composeApp:installDebug),
    -- but require an exact task-name suffix so short bases like "test" or
    -- "build" don't match unrelated tasks.
    local suffix = ":" .. base
    for _, task in ipairs(tasks) do
        if task.name == base or task.name:sub(-#suffix) == suffix then
            return task.name
        end
    end
    return nil
end

function M.resolve_task(base, tasks)
    return resolve_task(base, tasks)
end

function M.curated_options(root, tasks)
    local project = require("forge.project").detect(root)
    local curated = vim.deepcopy(CURATED)
    if project.is_kmp then
        vim.list_extend(curated, KMP_CURATED)
    end

    local options = {}
    for _, item in ipairs(curated) do
        local resolved = resolve_task(item.base, tasks)
        if resolved then
            local task
            for _, t in ipairs(tasks) do
                if t.name == resolved then
                    task = t
                    break
                end
            end
            table.insert(options, {
                label = item.label,
                description = resolved .. " — " .. (task and task.description or item.description),
                task = resolved,
            })
        end
    end
    return options
end

function M.run_task(task_name, root)
    root = root or util.project_root()
    local command = "./gradlew " .. task_name .. " --console=plain"
    logs.run_with_output("Forge Gradle — " .. task_name, command, root, function(code)
        if code == 0 then
            vim.notify("Gradle task finished: " .. task_name, vim.log.levels.INFO)
        else
            vim.notify("Gradle task failed: " .. task_name, vim.log.levels.ERROR)
        end
    end)
end

function M.menu(opts)
    opts = opts or {}
    local root = util.project_root()
    M.discover_tasks(root, function(tasks, err)
        if not tasks then
            vim.notify(err or "Could not load Gradle tasks", vim.log.levels.ERROR)
            return
        end

        if opts.all then
            local items = {}
            for _, task in ipairs(tasks) do
                table.insert(items, {
                    label = task.name,
                    description = task.description,
                    task = task.name,
                })
            end
            util.pick("Forge Gradle — all tasks", items, function(choice)
                if choice and choice.task then
                    M.run_task(choice.task, root)
                end
            end)
            return
        end

        local items = M.curated_options(root, tasks)
        table.insert(items, {
            label = "Show all tasks…",
            description = "Browse every Gradle task",
            action = "all",
        })
        util.pick("Forge Gradle", items, function(choice)
            if not choice then
                return
            end
            if choice.action == "all" then
                M.menu({ all = true })
                return
            end
            if choice.task then
                M.run_task(choice.task, root)
            end
        end)
    end)
end

return M
