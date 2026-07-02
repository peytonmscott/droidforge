local M = {}

function M.path_join(...)
    return table.concat({ ... }, "/")
end

function M.file_exists(path)
    return vim.fn.filereadable(path) == 1 or vim.fn.isdirectory(path) == 1
end

function M.read_file(path)
    if not M.file_exists(path) then
        return ""
    end
    local ok, lines = pcall(vim.fn.readfile, path)
    if not ok then
        return ""
    end
    return table.concat(lines, "\n")
end

function M.buffer_path()
    local name = vim.api.nvim_buf_get_name(0)
    if name == "" then
        return vim.fn.getcwd()
    end
    return name
end

function M.project_root(start_path)
    start_path = start_path or M.buffer_path()
    return vim.fs.root(start_path, {
        "gradlew",
        "settings.gradle",
        "settings.gradle.kts",
        "build.gradle",
        "build.gradle.kts",
        "pom.xml",
        "package.json",
        "Cargo.toml",
        "go.mod",
        "Podfile",
        ".git",
    }) or vim.fn.getcwd()
end

function M.is_macos()
    return vim.loop.os_uname().sysname == "Darwin"
end

function M.executable(name)
    return vim.fn.executable(name) == 1
end

function M.trim(value)
    return vim.trim(value or "")
end

function M.system_text(argv, opts, callback)
    opts = opts or {}
    opts.text = true
    vim.system(argv, opts, function(result)
        vim.schedule(function()
            callback(result)
        end)
    end)
end

function M.system_sync(argv, opts)
    opts = opts or {}
    opts.text = true
    return vim.system(argv, opts):wait()
end

function M.pick(prompt, items, on_select)
    if #items == 0 then
        vim.notify("No items to select", vim.log.levels.WARN)
        return
    end

    local labels = {}
    for _, item in ipairs(items) do
        local label = item.label or item[1]
        if item.description and item.description ~= "" then
            label = label .. " — " .. item.description
        end
        table.insert(labels, label)
    end

    local telescope_ok, pickers = pcall(require, "telescope.pickers")
    if telescope_ok then
        pickers.new({}, {
            prompt_title = prompt,
            finder = require("telescope.finders").new_table({
                results = items,
                entry_maker = function(entry)
                    local display = entry.label or entry[1]
                    if entry.description and entry.description ~= "" then
                        display = display .. " — " .. entry.description
                    end
                    return {
                        value = entry,
                        display = display,
                        ordinal = display,
                    }
                end,
            }),
            sorter = require("telescope.config").values.generic_sorter({}),
            attach_mappings = function(_, map)
                local function confirm(prompt_bufnr)
                    local selection = require("telescope.actions.state").get_selected_entry(prompt_bufnr)
                    require("telescope.actions").close(prompt_bufnr)
                    if selection and on_select then
                        on_select(selection.value)
                    end
                end
                map("i", "<CR>", confirm)
                map("n", "<CR>", confirm)
                return true
            end,
        }):find()
        return
    end

    vim.ui.select(labels, { prompt = prompt }, function(choice, idx)
        if choice and idx and on_select then
            on_select(items[idx])
        end
    end)
end

function M.gradle_files(root)
    local files = {}
    vim.list_extend(files, vim.fn.globpath(root, "build.gradle", false, true))
    vim.list_extend(files, vim.fn.globpath(root, "build.gradle.kts", false, true))
    vim.list_extend(files, vim.fn.globpath(root, "*/build.gradle", false, true))
    vim.list_extend(files, vim.fn.globpath(root, "*/build.gradle.kts", false, true))
    vim.list_extend(files, vim.fn.globpath(root, "*/*/build.gradle.kts", false, true))
    return files
end

function M.emulator_path()
    local home = os.getenv("ANDROID_HOME") or os.getenv("ANDROID_SDK_ROOT")
    if home then
        local candidate = M.path_join(home, "emulator", "emulator")
        if M.executable(candidate) then
            return candidate
        end
    end
    if M.executable("emulator") then
        return "emulator"
    end
    return nil
end

function M.adb_path()
    if M.executable("adb") then
        return "adb"
    end
    local home = os.getenv("ANDROID_HOME") or os.getenv("ANDROID_SDK_ROOT")
    if home then
        local candidate = M.path_join(home, "platform-tools", "adb")
        if M.executable(candidate) then
            return candidate
        end
    end
    return nil
end

return M
