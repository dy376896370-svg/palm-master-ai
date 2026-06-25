import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <Link className="legal-back" href="/">← 返回 AI手相大师</Link>
        <p className="section-kicker mt-10">PRIVACY</p>
        <h1>隐私说明</h1>
        <p className="legal-updated">更新日期：2026年6月26日</p>

        <h2>我们处理什么</h2>
        <p>当你主动上传手掌照片时，照片会发送给 AI 服务商以完成本次图像观察和文字报告生成。</p>

        <h2>我们不做什么</h2>
        <p>本站当前不提供登录、数据库或历史记录功能，不主动保存你的照片和分析报告，也不会将照片用于身份识别。</p>

        <h2>你可以如何保护自己</h2>
        <p>请只上传自己的照片，避免照片中出现面部、证件、地址或其他不必要的个人信息。使用公共设备后请关闭页面。</p>

        <h2>体验性质</h2>
        <p>本服务属于传统文化参考、娱乐体验与自我探索，不构成医疗、投资、婚姻、法律或人生决策建议。</p>
      </div>
    </main>
  );
}
