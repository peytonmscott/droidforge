local M = {}

function M.setup()
    local neotone_ok, neotone = pcall(require, "neotone")
    if not neotone_ok then
        return
    end
    neotone.setup({
        mode = "system",
        themes = {
            dark = "catppuccin-mocha",
            light = "catppuccin-frappe",
        },
    })
end

return M
