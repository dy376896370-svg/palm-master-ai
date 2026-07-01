# Palm Canon Lab

Palm Canon Lab 是 AI 手相大师的原典研究工作区，用来把掌纹相关书籍从“来源”整理成可审核、可追溯、可导入的知识条目。

本目录只保存研究流程、核验规则和导入前说明。真正的资料草稿放在 `data/canon-lab/` 下。

## 当前原则

- 不把未经核验的资料直接接入正式报告。
- 不编造古籍或英文原文。
- 引用原文与现代解释必须分离。
- 每条 Claim 必须能追溯到 Source 和 Evidence。
- 对掌纹相关说法标注文化传统属性，不包装成科学结论。

## 第一条流水线

当前第一本书：

- 书名：Palmistry for All
- 作者：Cheiro
- 方向：Western Palmistry
- 研究目录：`data/canon-lab/western/cheiro-palmistry-for-all/`

## 输出目标

每本书最终形成以下研究资产：

1. source.md：来源记录
2. verification.md：版本与版权核验
3. extraction-plan.md：抽取主题计划
4. claims.json：现代中文 Claim 草稿
5. evidence.json：Claim 对应证据链

这些文件完成 Review 后，才允许进入 Palm Canon Knowledge Engine。
