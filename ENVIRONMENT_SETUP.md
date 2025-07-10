# 修复 Node.js 环境配置以进行自动化测试

本文档旨在指导您如何正确配置 Node.js 环境，以解决在 Apple Silicon (M-系列芯片) Mac 上因 CPU 架构不匹配而导致的自动化测试失败问题。

## 1. 问题说明

自动化测试（特别是使用 Puppeteer 的端到端测试）失败的根本原因如下：

- **芯片架构不匹配**: 您的 Mac 使用的是 `arm64` 架构的 Apple Silicon 芯片，但您环境中安装的 Node.js 是为 `x64` 架构（Intel 芯片）编译的。
- **性能瓶颈**: 当 `x64` 应用在 `arm64` 芯片上运行时，macOS 会通过 Rosetta 2 兼容层进行实时“翻译”。这个过程会极大地降低性能，导致浏览器等程序无法在测试框架的默认超时时间内启动，从而使测试失败。

## 2. 解决方案

解决方案是安装与您 Mac 芯片原生匹配的 `arm64` 架构的 Node.js 版本。我们强烈推荐使用 **NVM (Node Version Manager)** 来管理 Node.js，它可以轻松地安装、切换不同版本，并能自动为您选择正确的架构。

### 第 1 步：安装 NVM (Node Version Manager)

如果您尚未安装 NVM，请在终端中执行以下命令。此命令会从官方 GitHub 仓库下载并运行安装脚本。

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

### 第 2 步：激活 NVM

安装完成后，您需要关闭并重新打开终端，以使 NVM 命令生效。或者，您可以运行以下命令来立即加载 NVM（适用于 macOS 默认的 zsh 环境）：

```bash
source ~/.zshrc
```

### 第 3 步：安装 arm64 架构的 Node.js

现在，使用 NVM 来安装最新长期支持版（LTS）的 Node.js。NVM 会自动检测您的 `arm64` 芯片并下载正确的版本。

```bash
nvm install --lts
```

安装成功后，您会看到类似 `Now using node v20.15.0 (npm v10.7.0)` 的提示。

### 第 4 步：验证安装

运行以下命令，确认您当前使用的 Node.js 版本是为 `arm64` 架构编译的。

```bash
node -p process.arch
```

**预期的输出结果应为：**

```
arm64
```

如果看到 `arm64`，则证明您的环境已配置正确。

### 第 5 步：更新项目依赖

由于更换了 Node.js 的核心版本，您需要重新安装项目的依赖包以确保兼容性。

1.  **删除旧的依赖文件和文件夹**：

    ```bash
    rm -rf node_modules package-lock.json
    ```

2.  **重新安装所有依赖**：

    ```bash
    npm install
    ```

---

完成以上所有步骤后，您的开发环境问题就解决了。此时，我就可以重新运行自动化测试，并且能够顺利完成。
