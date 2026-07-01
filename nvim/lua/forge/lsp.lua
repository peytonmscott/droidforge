local util = require("forge.util")

local M = {}

function M.setup()
    local servers = {
        "copilot-language-server",
        "roslyn",
        "lua_ls",
        "basedpyright",
        "marksman",
        "yamlls",
        "terraformls",
        "ts_ls",
        "jsonls",
    }

    if util.executable("jdtls") then
        table.insert(servers, "jdtls")
    end

    if util.is_macos() then
        local sk = util.system_sync({ "xcrun", "--find", "sourcekit-lsp" })
        if sk.code == 0 then
            vim.lsp.config("sourcekit_lsp", {
                cmd = { util.trim(sk.stdout) },
                filetypes = { "swift", "objective-c", "objective-cpp" },
                root_markers = { "Package.swift", ".git", "xcodeproj", "xcworkspace" },
            })
            table.insert(servers, "sourcekit_lsp")
        end
    end

    vim.lsp.enable(servers)

    vim.api.nvim_create_autocmd("LspAttach", {
        callback = function(args)
            vim.o.signcolumn = "yes:1"
            local client = vim.lsp.get_client_by_id(args.data.client_id)
            if client and client:supports_method("textDocument/completion") then
                vim.lsp.completion.enable(true, client.id, args.buf)
            end
        end,
    })

    local function format_buffer(bufnr)
        vim.lsp.buf.format({ async = false, timeout_ms = 3000, bufnr = bufnr })
    end

    vim.api.nvim_create_autocmd("BufWritePre", {
        callback = function(args)
            local clients = vim.lsp.get_clients({
                bufnr = args.buf,
                method = "textDocument/formatting",
            })
            if #clients > 0 then
                format_buffer(args.buf)
            end
        end,
    })

    vim.keymap.set("n", "<leader>lf", function()
        format_buffer(0)
    end, { silent = true, desc = "Format file" })

    vim.keymap.set("i", "<Down>", function()
        if vim.fn.pumvisible() == 1 then
            return vim.keycode("<C-n>")
        end
        return vim.keycode("<Down>")
    end, { expr = true, silent = true })

    vim.keymap.set("i", "<Up>", function()
        if vim.fn.pumvisible() == 1 then
            return vim.keycode("<C-p>")
        end
        return vim.keycode("<Up>")
    end, { expr = true, silent = true })

    vim.keymap.set("i", "<Tab>", 'pumvisible() == 1 ? "\\<C-y>" : copilot#Accept("\\<Tab>")', {
        expr = true,
        silent = true,
        replace_keycodes = false,
    })

    vim.keymap.set("i", "<CR>", function()
        if vim.fn.pumvisible() == 1 then
            return vim.keycode("<C-e><CR>")
        end
        return vim.keycode("<CR>")
    end, { expr = true, silent = true })
end

return M
