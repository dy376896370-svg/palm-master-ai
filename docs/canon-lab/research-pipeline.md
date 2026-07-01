# Palm Canon Lab Research Pipeline

以后每一本资料都必须按同一条流水线处理。

## 1. Source Discovery

目标：找到可靠来源，不使用无法追溯的转载站。

优先级：

1. 公共数字图书馆或权威文本库，例如 Project Gutenberg、Internet Archive、HathiTrust、Google Books 可预览扫描等。
2. 大学、图书馆、博物馆或学术项目。
3. 明确版权状态的出版社或开放资料。

记录内容：

- sourceTitle
- author
- language
- publicationYear
- sourceUrl
- archiveUrl
- documentId
- accessDate
- sourceType
- reliabilityNotes

## 2. Verification

目标：确认书名、作者、语言、年代、版本、公版状态、风险。

必须回答：

- 是否可用于研究？
- 是否可用于产品内展示？
- 是否只能做内部索引？
- 是否存在 OCR 错误、版本差异、版权风险？

## 3. Extraction Plan

目标：先定义要抽取哪些主题，不急着录入大量内容。

每个主题需要说明：

- topicId
- topicName
- relevantSections
- extractionPriority
- reviewNotes

## 4. Claims

目标：把原书中的观点转成可审核的现代中文 Claim。

规则：

- Claim 是现代中文归纳，不是原文复制。
- 不做命运断言。
- 不把文化传统说成科学事实。
- originalText 可以先留空；如保留，只能是极短引用。
- 每条 Claim 必须包含 sourceTitle、sourceUrl、chapterOrSection、verificationStatus。

## 5. Evidence

目标：为每条 Claim 建立证据链。

每条 Evidence 至少包含：

- claimId
- documentId
- sourceUrl
- evidenceType
- confidence
- notes

## 6. Review

目标：人工复核 Claim 是否真的来自该书。

Review Checklist：

- 来源链接可打开。
- 原文位置可定位。
- 现代中文归纳没有过度发挥。
- 没有复制大段原文。
- 没有科学化、绝对化、恐吓化表达。
- 适合未来进入用户报告。

## 7. Canon Import

只有 Review 通过后，才可以导入 Palm Canon Knowledge Engine。

导入时必须保留：

- canonicalSourceId
- claimId
- evidenceIds
- sourceTitle
- author
- chapterOrSection
- copyrightStatus
- verificationStatus

未通过 Review 的资料继续留在 Canon Lab，不进入正式用户报告。
