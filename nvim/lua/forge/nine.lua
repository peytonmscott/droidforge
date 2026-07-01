local M = {}

function M.setup()
    local nine_ok, nine_nine = pcall(require, "99")
    if not nine_ok then
        return
    end
    if type(nine_nine.setup) == "function" then
        nine_nine.setup()
    end
    vim.keymap.set("v", "<leader>9v", function()
        pcall(nine_nine.visual)
    end, { desc = "99 Visual" })
    vim.keymap.set("n", "<leader>9x", function()
        pcall(nine_nine.stop_all_requests)
    end, { desc = "99 Stop All Requests" })
    vim.keymap.set("n", "<leader>9s", function()
        pcall(nine_nine.search)
    end, { desc = "99 Search" })
end

return M
