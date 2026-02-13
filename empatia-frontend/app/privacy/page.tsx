import React from 'react';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-[#4D4D4D]">
      <header className="border-b border-gray-200 bg-white px-6 py-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="font-heading text-2xl font-bold text-[#5A7BFF]">
            EmpatIA
          </Link>
          <Link href="/" className="text-sm font-medium transition-colors hover:text-[#5A7BFF]">
            Voltar ao Início
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="font-heading mb-8 text-4xl font-bold text-[#4A5E90]">
          Política de Privacidade
        </h1>

        <div className="space-y-8 text-lg leading-relaxed">
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-[#4A5E90]">1. Recolha de Dados</h2>
            <p>
              Para fornecer a melhor experiência de companhia, a EmpatIA recolhe os seguintes dados:
            </p>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>Informação de registo (nome e email);</li>
              <li>Dados de voz e de conversa (para processamento da IA);</li>
              <li>Dados de utilização técnica (cookies essenciais).</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-[#4A5E90]">2. Utilização dos Dados</h2>
            <p>Os seus dados são utilizados exclusivamente para:</p>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>Gerir a sua conta;</li>
              <li>Melhorar as capacidades de compreensão e resposta da IA;</li>
              <li>Garantir a segurança e integridade do serviço.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-[#4A5E90]">
              3. Partilha de Informação
            </h2>
            <p>
              A EmpatIA não vende os seus dados pessoais a terceiros. Os dados de conversa são
              processados de forma segura e só são partilhados com fornecedores de tecnologia
              essenciais (ex: serviços de transcrição de voz e processamento de linguagem natural)
              sob rigorosos acordos de confidencialidade.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-[#4A5E90]">4. Segurança</h2>
            <p>
              Implementamos medidas de segurança técnicas e organizativas para proteger os seus
              dados contra acesso não autorizado, perda ou alteração. Recomendamos a utilização de
              uma palavra-passe forte e única.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-[#4A5E90]">5. Os Seus Direitos</h2>
            <p>
              Ao abrigo do RGPD, o utilizador tem o direito de aceder, retificar, eliminar ou
              limitar o tratamento dos seus dados. Para exercer estes direitos, contacte-nos através
              do email fornecido abaixo.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-[#4A5E90]">6. Contacto</h2>
            <p>
              Se tiver dúvidas sobre esta política, pode contactar-nos em:
              <a href="mailto:hello@empatia-portugal.pt" className="ml-1 text-[#5A7BFF]">
                hello@empatia-portugal.pt
              </a>
            </p>
          </section>

          <p className="pt-8 text-sm text-gray-500">
            Última atualização: {new Date().toLocaleDateString('pt-PT')}
          </p>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white px-6 py-12 text-center">
        <p className="text-gray-400">
          © {new Date().getFullYear()} EmpatIA. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
