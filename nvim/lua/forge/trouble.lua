local M = {}

function M.setup()
    local trouble_ok, trouble = pcall(require, "trouble")
    if trouble_ok then
        trouble.setup({})
    end
end

return M
