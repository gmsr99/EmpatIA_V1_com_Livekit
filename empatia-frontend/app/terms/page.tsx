import React from 'react';
import Link from 'next/link';

export default function TermsPage() {
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
        <h1 className="font-heading mb-8 text-4xl font-bold text-[#4A5E90]">Termos e Condições</h1>

        <div className="space-y-8 text-lg leading-relaxed">
          <section>
            <h2 className="mb-4 text-2xl font-semibold text-[#4A5E90]">1. Aceitação dos Termos</h2>
            <p>
              Ao utilizar a EmpatIA, o utilizador concorda em cumprir e vincular-se aos presentes
              Termos e Condições. Se não concordar com qualquer parte destes termos, não deverá
              utilizar os nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-[#4A5E90]">2. Descrição do Serviço</h2>
            <p>
              A EmpatIA é uma plataforma de inteligência artificial desenhada para fornecer apoio
              emocional e companhia. Não substitui aconselhamento médico, psicológico ou
              psiquiátrico profissional. Em caso de emergência ou crise, contacte imediatamente os
              serviços de emergência (112 em Portugal).
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-[#4A5E90]">
              3. Utilização Responsável
            </h2>
            <p>
              O utilizador compromete-se a utilizar a EmpatIA de forma ética e legal. É proibida a
              utilização do serviço para:
            </p>
            <ul className="mt-2 list-disc space-y-2 pl-6">
              <li>Assediar, ameaçar or abusar de outros;</li>
              <li>Tentar aceder a dados de outros utilizadores;</li>
              <li>Partilhar conteúdo ilegal ou ofensivo.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-[#4A5E90]">
              4. Limitação de Responsabilidade
            </h2>
            <p>
              A EmpatIA envida todos os esforços para fornecer respostas precisas e úteis, mas não
              garante a infalibilidade das informações prestadas pela IA. Não somos responsáveis por
              decisões tomadas com base nas interações com o sistema.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-[#4A5E90]">
              5. Propriedade Intelectual
            </h2>
            <p>
              Todos os conteúdos, marcas e tecnologia associados à EmpatIA são propriedade dos seus
              criadores e protegidos por leis de propriedade intelectual.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-semibold text-[#4A5E90]">6. Alterações aos Termos</h2>
            <p>
              Reservamos o direito de atualizar estes termos periodicamente. O uso continuado do
              serviço após as alterações constitui aceitação dos novos termos.
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
