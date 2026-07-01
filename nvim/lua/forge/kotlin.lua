local M = {}

function M.setup()
    local kotlin_ok, kotlin = pcall(require, "kotlin")
    if not kotlin_ok then
        return
    end

    local brew_kotlin_lsp = "/opt/homebrew/opt/kotlin-lsp/libexec"
    if not os.getenv("KOTLIN_LSP_DIR") and vim.fn.isdirectory(brew_kotlin_lsp) == 1 then
        vim.env.KOTLIN_LSP_DIR = brew_kotlin_lsp
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
