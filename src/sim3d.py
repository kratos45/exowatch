def get_neo_scene_html(a, e, is_pha, name):
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>body {{ margin: 0; overflow: hidden; background-color: #000; }}</style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
    </head>
    <body>
        <script>
            const a = {a if a is not None else 1.0};
            const e = {e if e is not None else 0.0};
            const is_pha = {str(is_pha).lower()};
            const au = 15; // 1 AU = 15 units in 3D space
            
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 30, 40);
            
            const renderer = new THREE.WebGLRenderer({{ antialias: true }});
            renderer.setSize(window.innerWidth, window.innerHeight);
            document.body.appendChild(renderer.domElement);
            
            const controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.5;
            
            // Lights
            const ambientLight = new THREE.AmbientLight(0x333333);
            scene.add(ambientLight);
            const pointLight = new THREE.PointLight(0xffffff, 2.5, 500);
            scene.add(pointLight);
            
            // Texture Loader
            const loader = new THREE.TextureLoader();
            
            // Sun (Yellow glowing sphere)
            const sunGeo = new THREE.SphereGeometry(2.5, 32, 32);
            const sunMat = new THREE.MeshBasicMaterial({{ 
                color: 0xffdd44,
                map: loader.load('https://upload.wikimedia.org/wikipedia/commons/e/ea/8k_sun_map.jpg', 
                    undefined, undefined, function(err) {{ console.log("Sun texture failed to load, using basic color."); }}
                )
            }});
            const sun = new THREE.Mesh(sunGeo, sunMat);
            scene.add(sun);
            
            // Earth
            const earthGeo = new THREE.SphereGeometry(0.8, 32, 32);
            const earthMat = new THREE.MeshStandardMaterial({{ 
                color: 0xffffff,
                map: loader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'),
                roughness: 0.6
            }});
            const earth = new THREE.Mesh(earthGeo, earthMat);
            scene.add(earth);
            
            // Earth Orbit (Circle at 1 AU)
            const earthOrbitGeo = new THREE.BufferGeometry();
            const earthOrbitPts = [];
            for(let i=0; i<=120; i++) {{
                const th = (i/120) * Math.PI * 2;
                earthOrbitPts.push(new THREE.Vector3(Math.cos(th)*au, 0, Math.sin(th)*au));
            }}
            earthOrbitGeo.setFromPoints(earthOrbitPts);
            const earthOrbitMat = new THREE.LineBasicMaterial({{ color: 0x4466aa, transparent: true, opacity: 0.5 }});
            scene.add(new THREE.Line(earthOrbitGeo, earthOrbitMat));
            
            // Asteroid (NEO)
            const neoGeo = new THREE.SphereGeometry(0.5, 16, 16); // Asteroid shape is irregular, but sphere for simplicity
            // Deform the sphere slightly to look like a rock
            const pos = neoGeo.attributes.position;
            for(let i=0; i<pos.count; i++) {{
                pos.setXYZ(i, pos.getX(i)*(0.8+Math.random()*0.4), pos.getY(i)*(0.8+Math.random()*0.4), pos.getZ(i)*(0.8+Math.random()*0.4));
            }}
            neoGeo.computeVertexNormals();
            
            const neoMat = new THREE.MeshStandardMaterial({{ 
                color: is_pha ? 0xff4444 : 0xaaaaaa, 
                roughness: 0.9 
            }});
            const neo = new THREE.Mesh(neoGeo, neoMat);
            scene.add(neo);
            
            // NEO Orbit (Ellipse)
            const neoOrbitGeo = new THREE.BufferGeometry();
            const neoOrbitPts = [];
            for(let i=0; i<=120; i++) {{
                const th = (i/120) * Math.PI * 2;
                const r = (a * (1 - e*e)) / (1 + e * Math.cos(th));
                neoOrbitPts.push(new THREE.Vector3(r * Math.cos(th) * au, 0, r * Math.sin(th) * au));
            }}
            neoOrbitGeo.setFromPoints(neoOrbitPts);
            const neoOrbitMat = new THREE.LineBasicMaterial({{ color: is_pha ? 0xff5555 : 0x888888, transparent: true, opacity: 0.8 }});
            scene.add(new THREE.Line(neoOrbitGeo, neoOrbitMat));
            
            let time = 0;
            function animate() {{
                requestAnimationFrame(animate);
                time += 0.005; // Base time step
                
                // Earth motion
                const earth_speed = 1.0;
                earth.position.x = Math.cos(time * earth_speed) * au;
                earth.position.z = Math.sin(time * earth_speed) * au;
                earth.rotation.y += 0.02;
                sun.rotation.y += 0.005;
                
                // NEO motion (approximate speed based on Kepler's 3rd Law: T^2 prop a^3)
                // dTheta/dt varies, but for simple visualization we use a constant average speed
                const neo_speed = 1.0 / Math.pow(a, 1.5);
                const neo_theta = time * neo_speed;
                const r = (a * (1 - e*e)) / (1 + e * Math.cos(neo_theta));
                neo.position.x = r * Math.cos(neo_theta) * au;
                neo.position.z = r * Math.sin(neo_theta) * au;
                neo.rotation.x += 0.05;
                neo.rotation.y += 0.03;
                
                controls.update();
                renderer.render(scene, camera);
            }}
            animate();
            
            window.addEventListener('resize', () => {{
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            }});
        </script>
    </body>
    </html>
    """

def get_exo_scene_html(radius, teff, name):
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>body {{ margin: 0; overflow: hidden; background-color: #000; }}</style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
    </head>
    <body>
        <script>
            const r_val = {radius if radius is not None else 1.0};
            const teff = {teff if teff is not None else 5000};
            
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 15, 30);
            
            const renderer = new THREE.WebGLRenderer({{ antialias: true }});
            renderer.setSize(window.innerWidth, window.innerHeight);
            document.body.appendChild(renderer.domElement);
            
            const controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.5;
            
            // Star color heuristic based on temperature (teff)
            let starColor = 0xffcc00; // Sun-like
            if (teff > 7500) starColor = 0x88bbff; // Hot blue
            else if (teff < 4000) starColor = 0xff5522; // Cool red
            
            const ambientLight = new THREE.AmbientLight(0x222222);
            scene.add(ambientLight);
            const pointLight = new THREE.PointLight(starColor, 2, 500);
            scene.add(pointLight);
            
            // Star
            const starGeo = new THREE.SphereGeometry(4, 32, 32);
            const starMat = new THREE.MeshBasicMaterial({{ color: starColor }});
            const star = new THREE.Mesh(starGeo, starMat);
            scene.add(star);
            
            // Exoplanet (Scale: 1 Earth radius = 0.8 units)
            const pSize = Math.max(0.3, Math.min(r_val * 0.8, 6.0));
            const exoGeo = new THREE.SphereGeometry(pSize, 32, 32);
            
            // A nice procedural material for the exoplanet
            const exoMat = new THREE.MeshStandardMaterial({{ 
                color: 0x44aacc,
                roughness: 0.5,
                metalness: 0.1
            }});
            const exo = new THREE.Mesh(exoGeo, exoMat);
            scene.add(exo);
            
            // Orbit path
            const dist = 18; 
            const orbitGeo = new THREE.BufferGeometry();
            const orbitPts = [];
            for(let i=0; i<=120; i++) {{
                const th = (i/120) * Math.PI * 2;
                orbitPts.push(new THREE.Vector3(Math.cos(th)*dist, 0, Math.sin(th)*dist));
            }}
            orbitGeo.setFromPoints(orbitPts);
            const orbitMat = new THREE.LineBasicMaterial({{ color: 0x555555, transparent: true, opacity: 0.5 }});
            scene.add(new THREE.Line(orbitGeo, orbitMat));
            
            let time = 0;
            function animate() {{
                requestAnimationFrame(animate);
                time += 0.01;
                
                exo.position.x = Math.cos(time) * dist;
                exo.position.z = Math.sin(time) * dist;
                exo.rotation.y += 0.02;
                star.rotation.y += 0.005;
                
                controls.update();
                renderer.render(scene, camera);
            }}
            animate();
            
            window.addEventListener('resize', () => {{
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            }});
        </script>
    </body>
    </html>
    """
