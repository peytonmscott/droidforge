import { BoxRenderable, Text, TextAttributes } from "@opentui/core";
import { ActionsViewModel } from '../../viewmodels';
import { ansiToStyledText } from "../../utilities";

function stripAnsi(text: string): string {
    return text
        // CSI
        .replace(/\u001b\[[0-9;?]*[@-~]/g, '')
        // OSC (BEL or ST terminator)
        .replace(/\u001b\][^\u0007]*(\u0007|\u001b\\)/g, '');
}

export function ActionOutputView(
    renderer: any,
    viewModel: ActionsViewModel,
    command: string,
    onBack?: () => void
): BoxRenderable {
    const container = new BoxRenderable(renderer, {
        id: "action-output-container",
        flexDirection: "column",
        flexGrow: 1,
    });

    const outputPanel = new BoxRenderable(renderer, {
        id: "output-panel",
        flexGrow: 1,
        border: true,
        borderStyle: "single",
        borderColor: "#475569",
        title: `Executing: ${command} (j/k: scroll, c: copy, ESC: cancel/back)`,
        titleAlignment: "left",
        margin: 1,
        onSizeChange: function() {
            viewModel.setOutputWindowSize(Math.max(1, this.height - 2));
        },
    });

    let outputText = Text({
        id: "output-text",
        content: "",
        attributes: TextAttributes.NONE,
        flexGrow: 1,
        wrapMode: 'char',
    });
    outputPanel.add(outputText);

    let statusBar = Text({ id: "status-bar", content: "", attributes: TextAttributes.DIM });

    container.add(outputPanel);
    container.add(statusBar);

    function getVisibleLineCount(): number {
        return Math.max(1, outputPanel.height - 2);
    }

    function updateOutput(): void {
        const output = viewModel.output;
        const visibleLineCount = getVisibleLineCount();

        viewModel.setOutputWindowSize(visibleLineCount);

        const visibleLines = output.lines.slice(
            output.scrollOffset,
            output.scrollOffset + visibleLineCount,
        );

        outputText = Text({
            id: "output-text",
            content: ansiToStyledText(visibleLines.join('\n')),
            attributes: TextAttributes.NONE,
            flexGrow: 1,
            wrapMode: 'char',
        });
        outputPanel.remove('output-text');
        outputPanel.add(outputText);

        const stateIcons: Record<string, string> = {
            'idle': '⏸',
            'running': '⏳',
            'completed': '✅',
            'error': '❌',
        };
        const stateIcon = stateIcons[viewModel.state];
        const exitInfo = output.exitCode !== null ? ` (exit: ${output.exitCode})` : '';
        const scrollInfo = `[${output.scrollOffset + 1}-${Math.min(output.scrollOffset + visibleLineCount, output.lines.length)}/${output.lines.length}]`;
        const statusColor = viewModel.state === 'error' ? TextAttributes.BOLD :
            viewModel.state === 'completed' ? TextAttributes.NONE :
                TextAttributes.DIM;

        statusBar = Text({
            id: "status-bar",
            content: `${stateIcon} ${viewModel.state}${exitInfo} ${scrollInfo}`,
            attributes: statusColor,
        });
        container.remove('status-bar');
        container.add(statusBar);
    }

    viewModel.setOutputUpdateCallback(updateOutput);

    renderer.keyInput.on("keypress", (key: any) => {
        switch (key.name) {
            case 'j':
            case 'down':
                if (viewModel.state !== 'idle') {
                    viewModel.scrollDown();
                }
                break;
            case 'k':
            case 'up':
                if (viewModel.state !== 'idle') {
                    viewModel.scrollUp();
                }
                break;
            case 'c':
                if (viewModel.state === 'completed' || viewModel.state === 'error') {
                    const text = stripAnsi(viewModel.getOutputText());
                    try {
                        Bun.spawn(['pbcopy'], {
                            stdin: new Response(text).body!
                        });
                        statusBar = Text({
                            id: "status-bar",
                            content: '📋 Copied to clipboard!',
                            attributes: TextAttributes.NONE,
                        });
                        container.remove('status-bar');
                        container.add(statusBar);
                        setTimeout(updateOutput, 1500);
                    } catch {
                        // Ignore clipboard errors
                    }
                }
                break;
            case 'escape':
                if (viewModel.state === 'running') {
                    viewModel.cancelTask();
                } else if (viewModel.state === 'completed' || viewModel.state === 'error') {
                    viewModel.reset();
                    if (onBack) onBack();
                }
                break;
        }
    });

    viewModel.setOutputWindowSize(getVisibleLineCount());
    viewModel.runGradleCommand(command);

    return container;
}
