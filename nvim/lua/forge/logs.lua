local util = require("forge.util")

local M = {}

local log_buffers = {}

function M.parse_logcat_line(line)
    local ts, pid, tid, level, tag, message = line:match(
        "^(%d%d%-%d%d %d%d:%d%d:%d%d%.%d+)%s+(%d+)%s+(%d+)%s+([VDIWEF])%s+([^:]+):%s*(.*)$"
    )
    if ts then
        return {
            raw = line,
            timestamp = ts,
            pid = tonumber(pid),
            tid = tonumber(tid),
            level = level,
            tag = util.trim(tag),
            message = message,
        }
    end

    local brief_level, brief_tag, brief_pid, brief_message = line:match("^([VDIWEF])/([^(]+)%((%d+)%)%s*:%s*(.*)$")
    if brief_level then
        return {
            raw = line,
            pid = tonumber(brief_pid),
            level = brief_level,
            tag = util.trim(brief_tag),
            message = brief_message,
        }
    end

    return { raw = line, level = "?", message = line }
end

local function setup_log_buffer_keymaps(bufnr, state)
    local function map(mode, lhs, rhs, desc)
        vim.keymap.set(mode, lhs, rhs, { buffer = bufnr, silent = true, desc = desc })
    end

    map("n", "j", "j", "Next line")
    map("n", "k", "k", "Previous line")
    map("n", "q", function()
        vim.api.nvim_buf_delete(bufnr, { force = true })
    end, "Close log")
    map("n", "p", function()
        state.paused = not state.paused
        if not state.paused then
            -- Lines kept accumulating while paused; catch the buffer up.
            M._render(bufnr, state)
        end
        vim.notify(state.paused and "Log paused" or "Log resumed", vim.log.levels.INFO)
    end, "Pause/resume")
    map("n", "x", function()
        vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, {})
        state.lines = {}
    end, "Clear buffer")
    map("n", "c", function()
        local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
        vim.fn.setreg("+", table.concat(lines, "\n"))
        vim.notify("Copied " .. #lines .. " lines", vim.log.levels.INFO)
    end, "Copy all to clipboard")
    map("n", "Y", function()
        local line = vim.api.nvim_get_current_line()
        vim.fn.setreg("+", line)
        vim.notify("Copied line", vim.log.levels.INFO)
    end, "Copy line")
    map("n", "G", "G", "Jump to end")
    map("n", "gg", "gg", "Jump to start")
    map("n", "f", function()
        vim.ui.input({ prompt = "Filter (tag or text): " }, function(input)
            if not input or input == "" then
                state.filter = nil
            else
                state.filter = input:lower()
            end
            M._render(bufnr, state)
        end)
    end, "Filter logs")
    map("n", "r", function()
        if state.restart then
            state.restart()
        end
    end, "Restart stream")
end

local function follow_tail(bufnr, state)
    if not state.follow then
        return
    end
    local winid = vim.fn.bufwinid(bufnr)
    if winid == -1 then
        return
    end
    local line_count = vim.api.nvim_buf_line_count(bufnr)
    if line_count > 0 then
        vim.api.nvim_win_set_cursor(winid, { line_count, 0 })
    end
end

function M._render(bufnr, state)
    vim.schedule(function()
        if not vim.api.nvim_buf_is_valid(bufnr) then
            return
        end
        local lines = {}
        for _, entry in ipairs(state.lines) do
            if not state.filter or entry.raw:lower():find(state.filter, 1, true) then
                table.insert(lines, entry.raw)
            end
        end
        vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, lines)
        follow_tail(bufnr, state)
    end)
end

function M._append(bufnr, state, raw_line)
    if raw_line == "" then
        return
    end
    local parsed = M.parse_logcat_line(raw_line)
    table.insert(state.lines, parsed)
    if #state.lines > (state.max_lines or 5000) then
        table.remove(state.lines, 1)
    end
    -- While paused, keep accumulating so nothing is lost; the resume keymap
    -- re-renders the full buffer.
    if state.paused then
        return
    end
    if not state.filter or parsed.raw:lower():find(state.filter, 1, true) then
        vim.schedule(function()
            if not vim.api.nvim_buf_is_valid(bufnr) then
                return
            end
            local line_count = vim.api.nvim_buf_line_count(bufnr)
            vim.api.nvim_buf_set_lines(bufnr, line_count, line_count, false, { parsed.raw })
            follow_tail(bufnr, state)
        end)
    end
end

function M.open_buffer(opts)
    opts = opts or {}
    local title = opts.title or "Forge Logs"
    local bufnr = vim.api.nvim_create_buf(false, true)
    vim.api.nvim_buf_set_name(bufnr, title)
    vim.bo[bufnr].buftype = "nofile"
    vim.bo[bufnr].bufhidden = "wipe"
    vim.bo[bufnr].swapfile = false
    vim.bo[bufnr].filetype = "forge-log"
    vim.bo[bufnr].modifiable = true

    vim.cmd("botright " .. (opts.height or 20) .. "split")
    vim.api.nvim_win_set_buf(0, bufnr)
    vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, { "# " .. title, "# p pause  c copy all  Y copy line  f filter  x clear  q close" })

    local state = {
        lines = {},
        paused = false,
        filter = opts.filter,
        follow = opts.follow ~= false,
        max_lines = opts.max_lines or 5000,
        job = nil,
        restart = opts.restart,
    }
    log_buffers[bufnr] = state
    setup_log_buffer_keymaps(bufnr, state)

    -- Stop the underlying job however the buffer goes away (:q, :bd, q, ...).
    vim.api.nvim_create_autocmd("BufWipeout", {
        buffer = bufnr,
        once = true,
        callback = function()
            if state.job then
                pcall(vim.fn.jobstop, state.job)
                state.job = nil
            end
            log_buffers[bufnr] = nil
        end,
    })

    return bufnr, state
end

-- jobstart callbacks deliver chunks split on "\n" already: each `data` list
-- item is a complete line except that the first item continues the previous
-- callback's last item. Track the partial line across callbacks.
local function line_appender(bufnr, state)
    local partial = ""
    return function(data)
        if not data then
            return
        end
        for i, chunk in ipairs(data) do
            chunk = chunk:gsub("\r$", "")
            if i == 1 then
                partial = partial .. chunk
            else
                M._append(bufnr, state, partial)
                partial = chunk
            end
        end
    end, function()
        if partial ~= "" then
            M._append(bufnr, state, partial)
            partial = ""
        end
    end
end

function M.stream_command(bufnr, state, argv, cwd)
    if state.job then
        vim.fn.jobstop(state.job)
    end
    local append_stdout, flush_stdout = line_appender(bufnr, state)
    local append_stderr, flush_stderr = line_appender(bufnr, state)
    state.job = vim.fn.jobstart(argv, {
        cwd = cwd,
        stdout_buffered = false,
        stderr_buffered = false,
        on_stdout = function(_, data)
            append_stdout(data)
        end,
        on_stderr = function(_, data)
            append_stderr(data)
        end,
        on_exit = function()
            state.job = nil
            flush_stdout()
            flush_stderr()
        end,
    })
end

function M.open_output_buffer(title, lines, opts)
    opts = opts or {}
    local bufnr, state = M.open_buffer({ title = title, height = opts.height or 20, follow = false })
    vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, lines or {})
    state.lines = {}
    for _, line in ipairs(lines or {}) do
        table.insert(state.lines, { raw = line, level = "?", message = line })
    end
    return bufnr
end

function M.run_with_output(title, command, cwd, on_complete)
    local bufnr, state = M.open_buffer({ title = title, height = 20, follow = true })
    vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, { "$ " .. command, "" })

    local shell = vim.o.shell
    local flag = vim.o.shellcmdflag or "-c"

    state.restart = function()
        if vim.api.nvim_buf_is_valid(bufnr) then
            vim.api.nvim_buf_delete(bufnr, { force = true })
        end
        M.run_with_output(title, command, cwd, on_complete)
    end

    local append_stdout, flush_stdout = line_appender(bufnr, state)
    local append_stderr, flush_stderr = line_appender(bufnr, state)

    state.job = vim.fn.jobstart({ shell, flag, command }, {
        cwd = cwd,
        on_stdout = function(_, data)
            append_stdout(data)
        end,
        on_stderr = function(_, data)
            append_stderr(data)
        end,
        on_exit = function(_, code)
            state.job = nil
            flush_stdout()
            flush_stderr()
            M._append(bufnr, state, "[forge] exit " .. tostring(code))
            if on_complete then
                vim.schedule(function()
                    on_complete(code, bufnr)
                end)
            end
        end,
    })
    return bufnr
end

function M.open_logcat(opts)
    opts = opts or {}
    local adb = util.adb_path()
    if not adb then
        vim.notify("adb not found. Set ANDROID_HOME or install platform-tools.", vim.log.levels.ERROR)
        return
    end

    local project = require("forge.project").detect()
    local package_name = opts.package or project.application_id
    local title = package_name and ("Forge Logcat — " .. package_name) or "Forge Logcat — device"

    local function start_stream(pid)
        local bufnr, state = M.open_buffer({ title = title, height = opts.height or 20, follow = true })
        local args = { adb }
        if opts.device then
            vim.list_extend(args, { "-s", opts.device })
        end
        vim.list_extend(args, { "logcat", "-v", "threadtime" })
        if pid then
            table.insert(args, "--pid=" .. pid)
        elseif not package_name then
            table.insert(args, "*:I")
        end
        state.restart = function()
            if vim.api.nvim_buf_is_valid(bufnr) then
                vim.api.nvim_buf_delete(bufnr, { force = true })
            end
            M.open_logcat(opts)
        end
        M.stream_command(bufnr, state, args, nil)
        return bufnr
    end

    if package_name then
        -- App logs must filter by PID: the applicationId is not a logcat tag.
        local pidof = { adb }
        if opts.device then
            vim.list_extend(pidof, { "-s", opts.device })
        end
        vim.list_extend(pidof, { "shell", "pidof", "-s", package_name })
        util.system_text(pidof, {}, function(result)
            local pid = util.trim(result.stdout or ""):match("^(%d+)")
            if pid then
                start_stream(pid)
            else
                vim.notify(
                    "Forge: " .. package_name .. " is not running; showing full device logcat.",
                    vim.log.levels.WARN
                )
                start_stream(nil)
            end
        end)
        return
    end

    return start_stream(nil)
end

function M.open_device_logcat(opts)
    return M.open_logcat(vim.tbl_extend("force", opts or {}, { package = nil }))
end

vim.api.nvim_set_hl(0, "ForgeLogError", { link = "DiagnosticError" })
vim.api.nvim_set_hl(0, "ForgeLogWarn", { link = "DiagnosticWarn" })

return M
