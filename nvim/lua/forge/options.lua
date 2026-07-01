local M = {}

function M.setup()
    vim.g.mapleader = " "

    local opt = vim.opt
    opt.confirm = true
    opt.signcolumn = "yes:1"
    opt.termguicolors = true
    opt.ignorecase = true
    opt.swapfile = false
    opt.autoindent = true
    opt.expandtab = true
    opt.tabstop = 4
    opt.softtabstop = 4
    opt.shiftwidth = 4
    opt.shiftround = true
    opt.number = true
    opt.relativenumber = true
    opt.numberwidth = 2
    opt.wrap = false
    opt.cursorline = true
    opt.scrolloff = 8
    opt.inccommand = "nosplit"
    opt.undodir = os.getenv("HOME") .. "/.vim/undodir"
    opt.undofile = true
    opt.completeopt = { "menu", "menuone", "popup", "noinsert" }
    opt.winborder = "rounded"
    opt.hlsearch = false
    opt.timeout = true
    opt.timeoutlen = 500
    vim.o.complete = ".,o"
    vim.o.autocomplete = true

    vim.schedule(function()
        vim.opt.clipboard = "unnamedplus"
    end)
    vim.cmd.filetype("plugin indent on")

    vim.api.nvim_create_autocmd("TextYankPost", {
        callback = function()
            vim.highlight.on_yank()
        end,
    })

    vim.keymap.set("n", "<leader>e", vim.diagnostic.open_float, { desc = "Open diagnostics float" })
    vim.g.copilot_no_tab_map = true

    vim.cmd([[
      if empty(v:servername)
        call serverstart('/tmp/nvim.sock')
      endif
    ]])
end

return M
