local M = {}

function M.setup()
    vim.pack.add({
        "https://github.com/nvim-telescope/telescope.nvim",
        "https://github.com/nvim-treesitter/nvim-treesitter",
        "https://github.com/nvim-telescope/telescope-ui-select.nvim",
        "https://github.com/nvim-telescope/telescope-fzf-native.nvim",
        "https://github.com/lewis6991/gitsigns.nvim",
        "https://github.com/neovim/nvim-lspconfig",
        "https://github.com/nvim-lua/plenary.nvim",
        "https://github.com/ThePrimeagen/99",
        "https://github.com/folke/sidekick.nvim",
        "https://github.com/github/copilot.vim",
        "https://github.com/folke/which-key.nvim",
        "https://github.com/twenty9-labs/neotone.nvim",
        { src = "https://github.com/catppuccin/nvim", name = "catppuccin" },
        "https://github.com/AlexandrosAlexiou/kotlin.nvim",
        "https://github.com/mfussenegger/nvim-dap",
        "https://github.com/folke/trouble.nvim",
        "https://github.com/stevearc/oil.nvim",
    })

    vim.cmd.packadd("cfilter")
    vim.cmd.packadd("nvim.undotree")
    vim.cmd.packadd("nvim.difftool")
end

return M
