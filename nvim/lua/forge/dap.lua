local M = {}

function M.setup()
    local dap_ok, dap = pcall(require, "dap")
    if not dap_ok then
        return
    end

    vim.fn.sign_define("DapBreakpoint", {
        text = "B",
        texthl = "DiagnosticSignError",
        linehl = "",
        numhl = "",
    })
    vim.fn.sign_define("DapStopped", {
        text = ">",
        texthl = "DiagnosticSignWarn",
        linehl = "Visual",
        numhl = "DiagnosticSignWarn",
    })
end

return M
