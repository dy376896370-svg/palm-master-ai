import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <Link className="legal-back" href="/">← 返回 AI手相大师</Link>
        <p className="section-kicker mt-10">TERMS</p>
        <h1>使用条款</h1>
        <p className="legal-updated">更新日期：2026年6月26日</p>

        <h2>适用范围</h2>
        <p>AI手相大师提供基于照片可见纹理的文化解读。结果由 AI 生成，可能存在遗漏、偏差或误判。</p>

        <h2>禁止用途</h2>
        <p>不得将结果用于医疗诊断、投资交易、婚姻决定、法律判断、身份识别或任何高风险决策。</p>

        <h2>上传责任</h2>
        <p>你应当只上传自己有权使用的照片，不得上传他人的私密照片、违法内容或侵犯第三方权利的材料。</p>

        <h2>服务可用性</h2>
        <p>公开体验可能因网络、AI 服务额度或维护而暂时中断。我们会尽力提供清晰的错误提示，但不保证服务持续可用。</p>
      </div>
    </main>
  );
}
