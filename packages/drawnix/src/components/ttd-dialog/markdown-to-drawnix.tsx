import { useState, useEffect, useDeferredValue, KeyboardEvent } from 'react';
import './mermaid-to-drawnix.scss';
import './ttd-dialog.scss';
import { TTDDialogPanels } from './ttd-dialog-panels';
import { TTDDialogPanel } from './ttd-dialog-panel';
import { TTDDialogInput } from './ttd-dialog-input';
import { TTDDialogOutput } from './ttd-dialog-output';
import { TTDDialogSubmitShortcut } from './ttd-dialog-submit-shortcut';
import { useDrawnix } from '../../hooks/use-drawnix';
import { useBoard } from '@plait-board/react-board';
import {
  getViewportOrigination,
  PlaitBoard,
  PlaitElement,
  WritableClipboardOperationType,
} from '@plait/core';
import { MindElement } from '@plait/mind';

export interface MarkdownToDrawnixLibProps {
  loaded: boolean;
  api: Promise<{
    parseMarkdownToDrawnix: (
      definition: string,
      mainTopic?: string
    ) => MindElement;
  }>;
}

const MARKDOWN_EXAMPLE = `# 我开始了

- 让我看看是谁搞出了这个 bug 🕵️ ♂️ 🔍
  - 😯 💣
    - 原来是我 👈 🎯 💘

- 竟然不可以运行，为什么呢 🚫 ⚙️ ❓
  - 竟然可以运行了，为什么呢？🎢 ✨
    - 🤯 ⚡ ➡️ 🎉

- 能运行起来的 🐞 🚀
  - 就不要去动它 🛑 ✋
    - 👾 💥 🏹 🎯
    
## 男孩还是女孩 👶 ❓ 🤷 ♂️ ♀️

### Hello world 👋 🌍 ✨ 💻

#### 哇 是个程序员 🤯 ⌨️ 💡 👩 💻`;

const MarkdownToDrawnix = () => {
  const { appState, setAppState } = useDrawnix();
  const [markdownToDrawnixLib, setMarkdownToDrawnixLib] =
    useState<MarkdownToDrawnixLibProps>({
      loaded: false,
      api: Promise.resolve({
        parseMarkdownToDrawnix: (definition: string, mainTopic?: string) =>
          null as any as MindElement,
      }),
    });

  useEffect(() => {
    const loadLib = async () => {
      try {
        const module = await import('@plait-board/markdown-to-drawnix');
        setMarkdownToDrawnixLib({
          loaded: true,
          api: Promise.resolve(module),
        });
      } catch (err) {
        console.error('Failed to load mermaid library:', err);
        setError(new Error('加载 Mermaid 库失败'));
      }
    };
    loadLib();
  }, []);
  const [text, setText] = useState(() => MARKDOWN_EXAMPLE);
  const [value, setValue] = useState<PlaitElement[]>(() => []);
  const deferredText = useDeferredValue(text.trim());
  const [error, setError] = useState<Error | null>(null);
  const board = useBoard();
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const convertMarkdown = async () => {
      try {
        const api = await markdownToDrawnixLib.api;
        let ret;
        try {
          ret = await api.parseMarkdownToDrawnix(deferredText);
        } catch (err: any) {
          ret = await api.parseMarkdownToDrawnix(
            deferredText.replace(/"/g, "'")
          );
        }
        const mind = ret;
        mind.points = [[0, 0]];
        if (mind) {
          setValue([mind]);
          setError(null);
        }
      } catch (err: any) {
        setError(err);
      }
    };
    convertMarkdown();
  }, [deferredText, markdownToDrawnixLib]);

  const handlePromptSubmit = async () => {
    if (!prompt || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('llm/invoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'markdown', prompt: prompt }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data && data.result) {
        setText(data.result);
        setPrompt('');
      } else {
        throw new Error('Invalid response format from API');
      }
    } catch (error) {
      console.error('API call failed', error);
      if (error instanceof Error) {
        setError(new Error(`通过AI生成Markdown失败: ${error.message}`));
      } else {
        setError(new Error('通过AI生成Markdown失败: 发生未知错误'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handlePromptSubmit();
    }
  };

  const insertToBoard = () => {
    if (!value.length) {
      return;
    }
    const boardContainerRect =
      PlaitBoard.getBoardContainer(board).getBoundingClientRect();
    const focusPoint = [
      boardContainerRect.width / 4,
      boardContainerRect.height / 2 - 20,
    ];
    const zoom = board.viewport.zoom;
    const origination = getViewportOrigination(board);
    const focusX = origination![0] + focusPoint[0] / zoom;
    const focusY = origination![1] + focusPoint[1] / zoom;
    const elements = value;
    board.insertFragment(
      {
        elements: JSON.parse(JSON.stringify(elements)),
      },
      [focusX, focusY],
      WritableClipboardOperationType.paste
    );
    setAppState({ ...appState, openDialogType: null });
  };

  return (
    <TTDDialogPanels>
      <TTDDialogPanel label={'Markdown 语法'}>
        <TTDDialogInput
          input={text}
          placeholder={'在此处编写 Markdown 文本定义...'}
          onChange={(event) => setText(event.target.value)}
          onKeyboardSubmit={() => {
            // insertToBoard();
          }}
        />
        <div
          className="prompt-container"
          style={{ marginTop: '10px', display: 'flex', gap: '8px' }}
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="输入提示词生成 Markdown..."
            disabled={isLoading}
            onKeyDown={handleKeyDown}
            style={{
              flexGrow: 1,
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
          <button
            onClick={handlePromptSubmit}
            disabled={isLoading}
            style={{
              padding: '0 16px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: isLoading ? '#ccc' : '#4a90e2',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            {isLoading ? '生成中...' : '生成'}
          </button>
        </div>
      </TTDDialogPanel>
      <TTDDialogPanel
        label={'预览'}
        panelAction={{
          action: () => {
            insertToBoard();
          },
          label: '插入',
        }}
        renderSubmitShortcut={() => <TTDDialogSubmitShortcut />}
      >
        <TTDDialogOutput
          value={value}
          loaded={markdownToDrawnixLib.loaded}
          error={error}
        />
      </TTDDialogPanel>
    </TTDDialogPanels>
  );
};
export default MarkdownToDrawnix;
