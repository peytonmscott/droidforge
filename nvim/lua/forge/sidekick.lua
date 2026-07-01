local M = {}

function M.setup()
    local sidekick_ok, sidekick = pcall(require, "sidekick")
    if not sidekick_ok then
        return
    end
    sidekick.setup({
        nes = { enabled = false },
        cli = {
            mux = { backend = "tmux", enabled = true },
        },
    })

    vim.keymap.set({ "n", "t", "i", "x" }, "<C-.>", function()
        require("sidekick.cli").focus()
    end, { desc = "Sidekick Focus" })
    vim.keymap.set("n", "<leader>aa", function()
        require("sidekick.cli").toggle()
    end, { desc = "Sidekick Toggle CLI" })
    vim.keymap.set("n", "<leader>as", function()
        require("sidekick.cli").select()
    end, { desc = "Select CLI" })
    vim.keymap.set("n", "<leader>ad", function()
        require("sidekick.cli").close()
    end, { desc = "Detach a CLI Session" })
    vim.keymap.set({ "x", "n" }, "<leader>at", function()
        require("sidekick.cli").send({ msg = "{this}" })
    end, { desc = "Send This" })
    vim.keymap.set("n", "<leader>af", function()
        require("sidekick.cli").send({ msg = "{file}" })
    end, { desc = "Send File" })
    vim.keymap.set("x", "<leader>av", function()
        require("sidekick.cli").send({ msg = "{selection}" })
    end, { desc = "Send Visual Selection" })
    vim.keymap.set({ "n", "x" }, "<leader>ap", function()
        require("sidekick.cli").prompt()
    end, { desc = "Sidekick Select Prompt" })
    vim.keymap.set("n", "<leader>ac", function()
        require("sidekick.cli").toggle({ name = "claude", focus = true })
    end, { desc = "Sidekick Toggle Claude" })
end

return M
