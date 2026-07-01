local util = require("forge.util")

local M = {}

local KOTLIN_ACTIONS = {
    { label = "Organize imports", description = "KotlinOrganizeImports", command = "KotlinOrganizeImports" },
    { label = "Format file", description = "IntelliJ-style Kotlin format", command = "KotlinFormat" },
    { label = "Toggle inlay hints", description = "KotlinInlayHintsToggle", command = "KotlinInlayHintsToggle" },
    { label = "Document symbols", description = "Outline for current file", command = "KotlinSymbols" },
    { label = "Workspace symbols", description = "Search project symbols", command = "KotlinWorkspaceSymbols" },
    { label = "Code actions", description = "Available quick fixes and refactors", command = "KotlinCodeActions" },
    { label = "Quick fix", description = "Apply suggested quick fix", command = "KotlinQuickFix" },
    { label = "Go to type definition", description = "LSP type definition", fn = function()
        vim.lsp.buf.type_definition()
    end },
    { label = "Go to implementation", description = "LSP implementation", fn = function()
        vim.lsp.buf.implementation()
    end },
    { label = "Incoming calls", description = "KotlinIncomingCalls", command = "KotlinIncomingCalls" },
    { label = "Outgoing calls", description = "KotlinOutgoingCalls", command = "KotlinOutgoingCalls" },
    { label = "New from template", description = "Class, data class, interface…", command = "KotlinNewFromTemplate" },
    { label = "Export workspace", description = "KotlinExportWorkspace", command = "KotlinExportWorkspace" },
    { label = "Clean LSP workspace", description = "Clear Kotlin LSP cache", command = "KotlinCleanWorkspace" },
    { label = "Debug attach", description = "KotlinDebug via nvim-dap", command = "KotlinDebug" },
}

function M.kotlin_menu()
    util.pick("Forge Kotlin", KOTLIN_ACTIONS, function(choice)
        if not choice then
            return
        end
        if choice.fn then
            choice.fn()
        elseif choice.command then
            vim.cmd(choice.command)
        end
    end)
end

function M.debug_menu()
    local dap_ok, dap = pcall(require, "dap")
    if not dap_ok then
        vim.notify("nvim-dap not available", vim.log.levels.ERROR)
        return
    end
    local items = {
        { label = "Toggle breakpoint", fn = dap.toggle_breakpoint },
        { label = "Continue", fn = dap.continue },
        { label = "Step over", fn = dap.step_over },
        { label = "Step into", fn = dap.step_into },
        { label = "Step out", fn = dap.step_out },
        { label = "REPL", fn = dap.repl.open },
        { label = "Terminate", fn = dap.terminate },
        { label = "Kotlin debug attach", command = "KotlinDebug" },
    }
    util.pick("Forge Debug", items, function(choice)
        if not choice then
            return
        end
        if choice.fn then
            choice.fn()
        elseif choice.command then
            vim.cmd(choice.command)
        end
    end)
end

function M.root_menu()
    local items = {
        { label = "Run…", description = "Web, Android, iOS, JVM", action = "run" },
        { label = "Gradle…", description = "Curated and all Gradle tasks", action = "gradle" },
        { label = "Devices…", description = "Android emulators and iOS simulators", action = "devices" },
        { label = "Logs…", description = "App logcat, device logs, build output", action = "logs" },
        { label = "Kotlin…", description = "All Kotlin LSP actions", action = "kotlin" },
        { label = "Debug…", description = "DAP and Kotlin debug", action = "debug" },
        { label = "Doctor", description = "Check toolchain health", action = "doctor" },
    }
    util.pick("Forge", items, function(choice)
        if not choice then
            return
        end
        if choice.action == "run" then
            require("forge.runner").run_menu()
        elseif choice.action == "gradle" then
            require("forge.gradle").menu()
        elseif choice.action == "devices" then
            M.devices_menu()
        elseif choice.action == "logs" then
            M.logs_menu()
        elseif choice.action == "kotlin" then
            M.kotlin_menu()
        elseif choice.action == "debug" then
            M.debug_menu()
        elseif choice.action == "doctor" then
            require("forge.doctor").run()
        end
    end)
end

function M.devices_menu()
    local items = {
        { label = "Android", description = "Emulators and adb devices", action = "android" },
    }
    if require("forge.ios").available() then
        table.insert(items, { label = "iOS", description = "Simulators and iosApp run", action = "ios" })
    end
    util.pick("Forge Devices", items, function(choice)
        if not choice then
            return
        end
        if choice.action == "android" then
            require("forge.android").menu()
        elseif choice.action == "ios" then
            require("forge.ios").menu()
        end
    end)
end

function M.logs_menu()
    local project = require("forge.project").detect()
    local items = {
        { label = "App logs", description = "Logcat filtered to applicationId", action = "app" },
        { label = "Device logs", description = "Full device logcat", action = "device" },
    }
    if project.application_id then
        items[1].description = project.application_id
    end
    util.pick("Forge Logs", items, function(choice)
        if not choice then
            return
        end
        if choice.action == "app" then
            require("forge.logs").open_logcat({ package = project.application_id })
        elseif choice.action == "device" then
            require("forge.logs").open_device_logcat()
        end
    end)
end

function M.setup()
    vim.api.nvim_create_user_command("Forge", M.root_menu, { desc = "Open Forge menu" })
    vim.api.nvim_create_user_command("ForgeRun", function()
        require("forge.runner").run_menu()
    end, { desc = "Forge run menu" })
    vim.api.nvim_create_user_command("ForgeGradle", function()
        require("forge.gradle").menu()
    end, { desc = "Forge Gradle menu" })
    vim.api.nvim_create_user_command("ForgeKotlin", M.kotlin_menu, { desc = "Forge Kotlin actions" })
    vim.api.nvim_create_user_command("ForgeLogs", M.logs_menu, { desc = "Forge logs menu" })
    vim.api.nvim_create_user_command("ForgeDevices", M.devices_menu, { desc = "Forge devices menu" })
    vim.api.nvim_create_user_command("ForgeDoctor", function()
        require("forge.doctor").run()
    end, { desc = "Forge toolchain doctor" })

    vim.keymap.set("n", "<leader>f", M.root_menu, { desc = "Forge menu" })
end

return M
