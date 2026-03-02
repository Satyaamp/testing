    function getIndianSeason() {
      const month = new Date().getMonth() + 1;
      if (month >= 3 && month <= 6) return 'summer';
      if (month >= 7 && month <= 10) return 'monsoon';
      return 'winter';
    }

    const season = getIndianSeason();
    document.body.className = season;

    const content = {
      summer: {
        tag: '☀️ Summer Season',
        title: 'Page Lost in the Summer Heat',
        message: 'The page you\'re searching for has vanished like morning dew under the scorching sun. Even our best search couldn\'t track it down in this heat!',
        precautions: [
          { icon: '💧', text: 'Stay hydrated - drink at least 8-10 glasses of water daily' },
          { icon: '🧢', text: 'Wear light-colored, loose cotton clothes and a hat when outdoors' },
          { icon: '☀️', text: 'Avoid going outside between 12 PM - 3 PM when sun is strongest' },
          { icon: '🍉', text: 'Eat water-rich fruits like watermelon, cucumber, and citrus' },
          { icon: '🏠', text: 'Keep your home cool with curtains, fans, or AC when possible' }
        ],
        svg: `
          <circle cx="250" cy="40" r="30" fill="#fbbf24">
            <animate attributeName="r" values="30;33;30" dur="2s" repeatCount="indefinite"/>
          </circle>
          <g id="sunRays">
            ${Array.from({length: 8}, (_, i) => {
              const angle = (i * 45) * Math.PI / 180;
              const x1 = 250 + Math.cos(angle) * 40;
              const y1 = 40 + Math.sin(angle) * 40;
              const x2 = 250 + Math.cos(angle) * 55;
              const y2 = 40 + Math.sin(angle) * 55;
              return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fbbf24" stroke-width="3" stroke-linecap="round">
                <animate attributeName="stroke-width" values="3;5;3" dur="2s" repeatCount="indefinite"/>
              </line>`;
            }).join('')}
          </g>
          
          <ellipse cx="150" cy="230" rx="120" ry="15" fill="#d97706" opacity="0.3"/>
          
          <g transform="translate(150, 180)">
            <path d="M -40 -50 Q 0 -70, 40 -50" fill="#ef4444" stroke="#dc2626" stroke-width="2">
              <animateTransform attributeName="transform" type="rotate" values="0 0 -50;-3 0 -50;0 0 -50;3 0 -50;0 0 -50" dur="4s" repeatCount="indefinite"/>
            </path>
            <line x1="0" y1="-50" x2="0" y2="-20" stroke="#78350f" stroke-width="2"/>
            
            <circle cx="0" cy="-15" r="12" fill="#fed7aa"/>
            <line x1="0" y1="-3" x2="0" y2="25" stroke="#ea580c" stroke-width="8" stroke-linecap="round"/>
            
            <line x1="0" y1="5" x2="-15" y2="15" stroke="#fed7aa" stroke-width="4" stroke-linecap="round">
              <animate attributeName="x2" values="-15;-12;-15" dur="3s" repeatCount="indefinite"/>
            </line>
            <line x1="0" y1="5" x2="0" y2="-20" stroke="#fed7aa" stroke-width="4" stroke-linecap="round"/>
            
            <line x1="0" y1="25" x2="-8" y2="40" stroke="#1e40af" stroke-width="5" stroke-linecap="round"/>
            <line x1="0" y1="25" x2="8" y2="40" stroke="#1e40af" stroke-width="5" stroke-linecap="round"/>
          </g>
          
          <path d="M 50 120 Q 60 110, 70 120 T 90 120" stroke="#fbbf24" stroke-width="2" fill="none" opacity="0.5">
            <animate attributeName="d" values="M 50 120 Q 60 110, 70 120 T 90 120;M 50 120 Q 60 130, 70 120 T 90 120;M 50 120 Q 60 110, 70 120 T 90 120" dur="2s" repeatCount="indefinite"/>
          </path>
        `
      },
      monsoon: {
        tag: '🌧️ Monsoon Season',
        title: 'Page Washed Away in the Rain',
        message: 'The page you\'re looking for has been swept away by the monsoon winds. Perhaps it\'s dancing in the rain clouds somewhere above!',
        precautions: [
          { icon: '☔', text: 'Always carry an umbrella or raincoat when stepping out' },
          { icon: '👟', text: 'Wear waterproof footwear to avoid slipping and infections' },
          { icon: '🦟', text: 'Use mosquito repellent and keep surroundings clean' },
          { icon: '🍲', text: 'Eat hot, freshly cooked food - avoid street food and raw vegetables' },
          { icon: '🏥', text: 'Watch for symptoms of fever, cold, or waterborne diseases' }
        ],
        svg: `
          <g opacity="0.9">
            <ellipse cx="100" cy="50" rx="40" ry="25" fill="#94a3b8">
              <animate attributeName="cx" values="100;105;100" dur="5s" repeatCount="indefinite"/>
            </ellipse>
            <ellipse cx="130" cy="45" rx="35" ry="22" fill="#cbd5e1">
              <animate attributeName="cy" values="45;42;45" dur="4s" repeatCount="indefinite"/>
            </ellipse>
            <ellipse cx="160" cy="50" rx="40" ry="25" fill="#94a3b8">
              <animate attributeName="cx" values="160;155;160" dur="6s" repeatCount="indefinite"/>
            </ellipse>
          </g>
          
          <path d="M 130 70 L 120 95 L 130 95 L 115 125" stroke="#fbbf24" stroke-width="3" fill="none" stroke-linecap="round">
            <animate attributeName="opacity" values="0;1;0;1;0" dur="2s" repeatCount="indefinite"/>
          </path>
          
          <ellipse cx="150" cy="230" rx="120" ry="15" fill="#475569" opacity="0.4"/>
          
          <g transform="translate(150, 180)">
            <circle cx="0" cy="-15" r="12" fill="#fcd34d"/>
            <path d="M -15 -20 Q 0 -28, 15 -20 L 12 -8 Q 0 -5, -12 -8 Z" fill="#3b82f6">
              <animateTransform attributeName="transform" type="rotate" values="0 0 -15;2 0 -15;0 0 -15;-2 0 -15;0 0 -15" dur="3s" repeatCount="indefinite"/>
            </path>
            
            <path d="M -20 -5 L -15 35 L 15 35 L 20 -5 Z" fill="#3b82f6"/>
            
            <line x1="-20" y1="5" x2="-30" y2="20" stroke="#2563eb" stroke-width="6" stroke-linecap="round">
              <animate attributeName="x2" values="-30;-28;-30" dur="2s" repeatCount="indefinite"/>
            </line>
            <line x1="20" y1="5" x2="30" y2="20" stroke="#2563eb" stroke-width="6" stroke-linecap="round">
              <animate attributeName="x2" values="30;32;30" dur="2.5s" repeatCount="indefinite"/>
            </line>
            
            <line x1="-8" y1="35" x2="-10" y2="50" stroke="#1e3a8a" stroke-width="5" stroke-linecap="round"/>
            <line x1="8" y1="35" x2="10" y2="50" stroke="#1e3a8a" stroke-width="5" stroke-linecap="round"/>
            
            <ellipse cx="-10" cy="52" rx="6" ry="3" fill="#422006"/>
            <ellipse cx="10" cy="52" rx="6" ry="3" fill="#422006"/>
          </g>
          
          <ellipse cx="150" cy="235" rx="50" ry="8" fill="#60a5fa" opacity="0.5">
            <animate attributeName="rx" values="50;55;50" dur="3s" repeatCount="indefinite"/>
          </ellipse>
        `
      },
      winter: {
        tag: '❄️ Winter Season',
        title: 'Page Frozen in the Cold',
        message: 'The page you\'re seeking has been frozen by the winter chill. We\'ll need to thaw it out to find where it went!',
        precautions: [
          { icon: '🧥', text: 'Layer up with warm clothes - jackets, sweaters, and shawls' },
          { icon: '🧴', text: 'Moisturize skin regularly to prevent dryness and cracking' },
          { icon: '☕', text: 'Drink warm fluids like tea, soup, and warm water throughout the day' },
          { icon: '🌤️', text: 'Get some sunlight exposure daily for vitamin D' },
          { icon: '🤧', text: 'Protect yourself from cold and flu - wash hands frequently' }
        ],
        svg: `
          <path d="M 0 180 Q 75 160, 150 180 T 300 180 L 300 250 L 0 250 Z" fill="#e0f2fe"/>
          <path d="M 0 200 Q 100 185, 200 200 T 300 200 L 300 250 L 0 250 Z" fill="#bae6fd"/>
          
          <ellipse cx="150" cy="230" rx="120" ry="15" fill="#0ea5e9" opacity="0.2"/>
          
          <g transform="translate(150, 180)">
            <ellipse cx="0" cy="-25" rx="14" ry="6" fill="#ef4444">
              <animate attributeName="ry" values="6;7;6" dur="2s" repeatCount="indefinite"/>
            </ellipse>
            <circle cx="0" cy="-30" r="4" fill="#fca5a5">
              <animate attributeName="r" values="4;4.5;4" dur="2s" repeatCount="indefinite"/>
            </circle>
            
            <circle cx="0" cy="-15" r="12" fill="#fed7aa"/>
            <ellipse cx="0" cy="-3" rx="14" ry="5" fill="#f97316"/>
            
            <path d="M -18 0 L -15 35 L 15 35 L 18 0 Z" fill="#1e40af"/>
            <line x1="0" y1="0" x2="0" y2="35" stroke="#1e3a8a" stroke-width="2"/>
            
            <line x1="-18" y1="8" x2="-28" y2="22" stroke="#1e40af" stroke-width="6" stroke-linecap="round">
              <animate attributeName="y2" values="22;20;22" dur="3s" repeatCount="indefinite"/>
            </line>
            <line x1="18" y1="8" x2="28" y2="22" stroke="#1e40af" stroke-width="6" stroke-linecap="round">
              <animate attributeName="y2" values="22;24;22" dur="2.5s" repeatCount="indefinite"/>
            </line>
            <circle cx="-28" cy="24" r="5" fill="#7c3aed"/>
            <circle cx="28" cy="24" r="5" fill="#7c3aed"/>
            
            <line x1="-8" y1="35" x2="-10" y2="50" stroke="#374151" stroke-width="6" stroke-linecap="round"/>
            <line x1="8" y1="35" x2="10" y2="50" stroke="#374151" stroke-width="6" stroke-linecap="round"/>
            
            <ellipse cx="-10" cy="52" rx="7" ry="4" fill="#78350f"/>
            <ellipse cx="10" cy="52" rx="7" ry="4" fill="#78350f"/>
          </g>
          
          <g transform="translate(220, 190)">
            <circle cx="0" cy="20" r="18" fill="white" stroke="#cbd5e1" stroke-width="2"/>
            <circle cx="0" cy="-5" r="13" fill="white" stroke="#cbd5e1" stroke-width="2"/>
            <circle cx="0" cy="-20" r="10" fill="white" stroke="#cbd5e1" stroke-width="2">
              <animate attributeName="r" values="10;10.5;10" dur="3s" repeatCount="indefinite"/>
            </circle>
            
            <path d="M 0 -20 L 8 -18" stroke="#f97316" stroke-width="2" stroke-linecap="round"/>
            
            <circle cx="-3" cy="-23" r="1.5" fill="#1f2937"/>
            <circle cx="3" cy="-23" r="1.5" fill="#1f2937"/>
            
            <circle cx="0" cy="-5" r="2" fill="#1f2937"/>
            <circle cx="0" cy="2" r="2" fill="#1f2937"/>
            
            <line x1="-13" y1="-5" x2="-22" y2="-10" stroke="#78350f" stroke-width="2">
              <animate attributeName="y2" values="-10;-8;-10" dur="4s" repeatCount="indefinite"/>
            </line>
            <line x1="13" y1="-5" x2="22" y2="-10" stroke="#78350f" stroke-width="2">
              <animate attributeName="y2" values="-10;-12;-10" dur="3s" repeatCount="indefinite"/>
            </line>
          </g>
        `
      }
    };

    // Apply season content
    document.getElementById('seasonTag').innerHTML = content[season].tag;
    document.getElementById('seasonTitle').textContent = content[season].title;
    document.getElementById('seasonMessage').textContent = content[season].message;
    document.getElementById('sceneSVG').innerHTML = content[season].svg;

    // Add precautions
    const precautionsHTML = `
      <h3><span class="precaution-icon">⚠️</span> ${season.charAt(0).toUpperCase() + season.slice(1)} Safety Tips</h3>
      ${content[season].precautions.map(p => `
        <div class="precaution-item">
          <span class="precaution-icon">${p.icon}</span>
          <span>${p.text}</span>
        </div>
      `).join('')}
    `;
    document.getElementById('precautionsCard').innerHTML = precautionsHTML;

    // Weather effects
    const weatherEffects = document.getElementById('weatherEffects');

    if (season === 'summer') {
      const sunRays = document.createElement('div');
      sunRays.className = 'sun-ray';
      sunRays.innerHTML = `
        <svg width="150" height="150" viewBox="0 0 150 150">
          <circle cx="75" cy="75" r="25" fill="#fbbf24" opacity="0.6"/>
          ${Array.from({length: 12}, (_, i) => {
            const angle = (i * 30) * Math.PI / 180;
            const x2 = 75 + Math.cos(angle) * 70;
            const y2 = 75 + Math.sin(angle) * 70;
            return `<line x1="75" y1="75" x2="${x2}" y2="${y2}" stroke="#fbbf24" stroke-width="3" opacity="0.4"/>`;
          }).join('')}
        </svg>
      `;
      weatherEffects.appendChild(sunRays);
      
      // Add butterflies
      for (let i = 0; i < 3; i++) {
        const butterfly = document.createElement('div');
        butterfly.className = 'butterfly';
        butterfly.textContent = '🦋';
        butterfly.style.left = (i * 30) + '%';
        butterfly.style.top = (20 + i * 15) + '%';
        butterfly.style.animationDelay = (i * 2) + 's';
        weatherEffects.appendChild(butterfly);
      }
      
    } else if (season === 'monsoon') {
      for (let i = 0; i < 100; i++) {
        const drop = document.createElement('div');
        drop.className = 'raindrop';
        drop.style.left = Math.random() * 100 + '%';
        drop.style.animationDelay = Math.random() * 2 + 's';
        drop.style.animationDuration = (Math.random() * 0.5 + 0.5) + 's';
        weatherEffects.appendChild(drop);
      }
      
      // Clouds
      for (let i = 0; i < 3; i++) {
        const cloud = document.createElement('div');
        cloud.className = 'cloud';
        cloud.style.top = (Math.random() * 30 + 10) + '%';
        cloud.style.animationDelay = (i * -10) + 's';
        cloud.innerHTML = `
          <svg width="100" height="50" viewBox="0 0 100 50">
            <ellipse cx="30" cy="25" rx="20" ry="15" fill="rgba(148, 163, 184, 0.6)"/>
            <ellipse cx="50" cy="20" rx="25" ry="18" fill="rgba(148, 163, 184, 0.7)"/>
            <ellipse cx="70" cy="25" rx="20" ry="15" fill="rgba(148, 163, 184, 0.6)"/>
          </svg>
        `;
        weatherEffects.appendChild(cloud);
      }

      // Falling leaves
      for (let i = 0; i < 5; i++) {
        const leaf = document.createElement('div');
        leaf.className = 'falling-leaf';
        leaf.textContent = '🍂';
        leaf.style.left = Math.random() * 100 + '%';
        leaf.style.animationDelay = Math.random() * 12 + 's';
        weatherEffects.appendChild(leaf);
      }
      
    } else if (season === 'winter') {
      // Snowflakes
      const snowflakes = ['❄', '❅', '❆'];
      for (let i = 0; i < 50; i++) {
        const flake = document.createElement('div');
        flake.className = 'snowflake';
        flake.textContent = snowflakes[Math.floor(Math.random() * snowflakes.length)];
        flake.style.left = Math.random() * 100 + '%';
        flake.style.animationDelay = Math.random() * 10 + 's';
        flake.style.animationDuration = (Math.random() * 5 + 10) + 's';
        flake.style.opacity = Math.random() * 0.6 + 0.4;
        weatherEffects.appendChild(flake);
      }
    }
