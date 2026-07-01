local M = {}

function M.setup()
    local telescope_ok, telescope = pcall(require, "telescope")
    if not telescope_ok then
        return
    end
    telescope.setup({
        extensions = {
            ["ui-select"] = require("telescope.themes").get_dropdown(),
        },
    })
    pcall(telescope.load_extension, "fzf")
    pcall(telescope.load_extension, "ui-select")

    vim.keymap.set("n", "<leader>sf", ":Telescope find_files<cr>", { silent = true, desc = "Find files" })
    vim.keymap.set("n", "<leader>sg", ":Telescope live_grep<cr>", { silent = true, desc = "Live grep" })
    vim.keymap.set("n", "<leader>sh", ":Telescope help_tags<cr>", { silent = true, desc = "Search help tags" })
    vim.keymap.set("n", "<leader>sd", ":Telescope diagnostics<cr>", { silent = true, desc = "Search diagnostics" })
    vim.keymap.set("n", "<leader>sb", ":Telescope buffers<cr>", { silent = true, desc = "Search buffers" })
    vim.keymap.set("n", "<leader>sk", ":Telescope keymaps<cr>", { silent = true, desc = "Search keymaps" })
end

return M
