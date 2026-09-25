import os
import torch
from diffusers import ShapEPipeline
from diffusers.utils import export_to_gif

# On charge le pipeline une seule fois en mémoire de façon optimisée
_pipe = None

def get_pipeline():
    global _pipe
    if _pipe is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        _pipe = ShapEPipeline.from_pretrained("openai/shap-e").to(device)
    return _pipe

def generate_asteroid_3d(material_type, output_path="asteroid_3d.gif"):
    """
    Génère un modèle 3D rotatif d'un astéroïde basé sur son matériau.
    Retourne le chemin vers le GIF généré.
    """
    pipe = get_pipeline()
    
    prompt = f"A realistic 3D model of an asteroid made of {material_type} floating in deep space, high detail"
    
    print(f"Génération 3D en cours pour : {prompt}...")
    
    # Génération
    images = pipe(
        prompt, 
        guidance_scale=15.0, 
        num_inference_steps=64, 
        frame_size=64
    ).images
    
    # Export du GIF selon la version de diffusers (liste simple ou liste de listes)
    if isinstance(images[0], list):
        export_to_gif(images[0], output_path)
    else:
        export_to_gif(images, output_path)
    
    return output_path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.animation as animation
import numpy as np

def generate_velocity_simulation(velocity_kmh, output_path="simulation.gif"):
    """
    Génère une animation GIF simulant le passage d'un astéroïde 
    à une vitesse proportionnelle. Rapide et n'utilise pas de ML lourd.
    """
    try:
        v = float(velocity_kmh)
    except:
        v = 50000.0
        
    frames = 30
    fig, ax = plt.subplots(figsize=(4, 3))
    fig.patch.set_facecolor('black')
    ax.set_facecolor('black')
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')
    
    # Draw asteroid
    circle = plt.Circle((0, 50), 4, color='#00FFFF')
    ax.add_patch(circle)
    
    # Calculate step size proportional to velocity
    # Normal velocity is around 30k to 100k
    dx = (v / 20000.0) * (100.0 / frames)
    dx = max(min(dx, 15.0), 1.0)
    
    # Add starfield background
    stars_x = np.random.rand(30) * 100
    stars_y = np.random.rand(30) * 100
    ax.scatter(stars_x, stars_y, color='white', s=1, alpha=0.5)
    
    def update(frame):
        x = (frame * dx) % 120 - 10
        circle.set_center((x, 50))
        return circle,
        
    ani = animation.FuncAnimation(fig, update, frames=frames, blit=True)
    ani.save(output_path, writer='pillow', fps=20)
    plt.close(fig)
    
    return output_path
