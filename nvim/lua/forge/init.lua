local M = {}

function M.setup()
    require("forge.options").setup()
    require("forge.plugins").setup()

    require("forge.telescope").setup()
    require("forge.treesitter").setup()
    require("forge.nine").setup()
    require("forge.neotone").setup()
    require("forge.sidekick").setup()
    require("forge.kotlin").setup()
    require("forge.trouble").setup()
    require("forge.dap").setup()
    require("forge.lsp").setup()
    require("forge.runner").setup()
    require("forge.menu").setup()

    local which_key_ok, which_key = pcall(require, "which-key")
    if which_key_ok then
        which_key.setup({})
        which_key.add({
            { "<leader>9", group = "99" },
            { "<leader>a", group = "agent" },
            { "<leader>d", group = "debug" },
            { "<leader>s", group = "search" },
            { "<leader>f", group = "forge" },
            { "<leader>l", group = "language" },
        })
    end
end

return M
