# inspector.py
import pkg_resources
import os
import importlib

print("--- RELATÓRIO DE VERSÕES ---")
try:
    print(f"livekit-agents: {pkg_resources.get_distribution('livekit-agents').version}")
    print(f"livekit-plugins-google: {pkg_resources.get_distribution('livekit-plugins-google').version}")
except Exception as e:
    print(f"Erro ao ler versões: {e}")

print("\n--- INSPEÇÃO DE ESTRUTURA ---")
try:
    import livekit.agents
    path = os.path.dirname(livekit.agents.__file__)
    print(f"Instalado em: {path}")
    
    print("\nFicheiros disponíveis na pasta 'agents':")
    files = [f for f in os.listdir(path) if f.endswith('.py')]
    print(files)
    
    print("\nClasses exportadas em livekit.agents:")
    print(dir(livekit.agents))
    
except Exception as e:
    print(f"Erro crítico: {e}")

print("\n--- TESTE DE IMPORTAÇÃO ---")
try:
    from livekit.agents.multimodal import MultimodalAgent
    print("SUCESSO: from livekit.agents.multimodal import MultimodalAgent")
except ImportError:
    print("FALHA: livekit.agents.multimodal não existe.")

try:
    from livekit.agents import MultimodalAgent
    print("SUCESSO: from livekit.agents import MultimodalAgent")
except ImportError:
    print("FALHA: livekit.agents não exporta MultimodalAgent.")