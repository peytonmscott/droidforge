local M = {}

local function kotlin_lsp_available()
    if os.getenv("KOTLIN_LSP_DIR") then
        return true
    end
    local mason_package_dir = vim.fn.expand("$MASON/packages/kotlin-lsp")
    return vim.fn.isdirectory(mason_package_dir) == 1
end

function M.setup()
    local kotlin_ok, kotlin = pcall(require, "kotlin")
    if not kotlin_ok then
        return
    end

    local brew_kotlin_lsp = "/opt/homebrew/opt/kotlin-lsp/libexec"
    if not os.getenv("KOTLIN_LSP_DIR") and vim.fn.isdirectory(brew_kotlin_lsp) == 1 then
        vim.env.KOTLIN_LSP_DIR = brew_kotlin_lsp
    end

    -- Without a kotlin-lsp install, kotlin.nvim raises a hard error from its
    -- FileType autocommand on every Kotlin buffer. Skip setup and warn once
    -- instead so editing still works.
    if not kotlin_lsp_available() then
        vim.api.nvim_create_autocmd("FileType", {
            pattern = "kotlin",
            once = true,
            callback = function()
                vim.notify(
                    "Forge: kotlin-lsp not found (install via `brew install kotlin-lsp` or set $KOTLIN_LSP_DIR). "
                        .. "Kotlin LSP features are disabled; run :ForgeDoctor for details.",
                    vim.log.levels.WARN
                )
            end,
        })
        return
    end

    kotlin.setup({
        root_markers = {
            "gradlew",
            "settings.gradle",
            "settings.gradle.kts",
            "build.gradle",
            "build.gradle.kts",
            "pom.xml",
            "Podfile",
            ".git",
        },
        inlay_hints = { enabled = true },
        folding = { enabled = true },
        build_tool = "gradle",
    })
end

return M
