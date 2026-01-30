// DOM Elements
const queryInput = document.getElementById('queryInput');
const searchBtn = document.getElementById('searchBtn');
const resultsContainer = document.getElementById('resultsContainer');
const resultsStats = document.getElementById('resultsStats');
const resultsHeader = document.getElementById('resultsHeader');
const loadingIndicator = document.getElementById('loadingIndicator');
const yearFilter = document.getElementById('yearFilter');
const outputTypeFilter = document.getElementById('outputTypeFilter');  // CHANGED: was organismFilter
const resultsCount = document.getElementById('resultsCount');
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
const navbar = document.getElementById('navbar');

// Backend API endpoint
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000' 
    : 'https://biosemantica-api.onrender.com';  // ⚠️ UPDATE THIS AFTER DEPLOYING!

const API_ENDPOINT = `${API_BASE_URL}/api/search`;

// Sample data for demonstration
const SAMPLE_RESULTS = [
    {
        id: 'paper_001',
        title: 'CRISPR-Cas9 mediated genome editing in human stem cells',
        abstract: 'This study demonstrates efficient CRISPR-Cas9 genome editing in human pluripotent stem cells. We developed a novel delivery method that improves editing efficiency by 40% while reducing off-target effects. The method was validated across three different cell lines.',
        year: 2023,
        organism: 'human',
        similarity_score: 0.95,
        authors: ['Smith J', 'Johnson A', 'Lee R'],
        journal: 'Nature Biotechnology'
    },
    {
        id: 'paper_002',
        title: 'p53 tumor suppressor mutations in cancer development',
        abstract: 'Comprehensive analysis of p53 mutations in 500 cancer samples reveals novel mutation hotspots associated with treatment resistance. Our findings suggest that specific p53 mutations may serve as prognostic biomarkers.',
        year: 2022,
        organism: 'human',
        similarity_score: 0.88,
        authors: ['Chen L', 'Wang Y', 'Garcia M'],
        journal: 'Cancer Cell'
    },
    {
        id: 'paper_003',
        title: 'Comparative genomics of canine lymphoma subtypes',
        abstract: 'We present a comprehensive genomic analysis of B-cell and T-cell lymphomas in dogs. The study identifies key genetic mutations and suggests potential targeted therapies that may benefit both veterinary and human oncology.',
        year: 2023,
        organism: 'dog',
        similarity_score: 0.82,
        authors: ['Brown K', 'Davis P'],
        journal: 'Veterinary Cancer Research'
    },
    {
        id: 'paper_004',
        title: 'Feline chronic kidney disease biomarkers',
        abstract: 'Novel protein biomarkers for early detection of chronic kidney disease in cats. Our approach enables detection 6-12 months earlier than traditional methods, potentially improving treatment outcomes.',
        year: 2021,
        organism: 'cat',
        similarity_score: 0.78,
        authors: ['Miller T', 'Wilson S', 'Anderson C'],
        journal: 'Journal of Feline Medicine'
    },
    {
        id: 'paper_005',
        title: 'Immunotherapy approaches in veterinary medicine',
        abstract: 'Comparative analysis of immunotherapy efficacy across species. We explore how treatments developed for humans can be adapted for companion animals, with focus on safety and efficacy profiles.',
        year: 2024,
        organism: 'dog',
        similarity_score: 0.75,
        authors: ['Rodriguez E', 'Kim H', 'Patel N'],
        journal: 'Comparative Medicine Journal'
    }
];

// Mobile Menu Toggle
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navLinks.classList.toggle('active');
});

// Close mobile menu when clicking a link
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
    });
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (!navLinks.contains(e.target) && !hamburger.contains(e.target)) {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
    }
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Scroll reveal animation with multiple types
const observerOptions = {
    threshold: 0.15,
    rootMargin: '0px 0px -80px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
            // Add staggered delay for multiple items
            setTimeout(() => {
                entry.target.classList.add('revealed');
            }, index * 100);
        }
    });
}, observerOptions);

// Observe all scroll reveal elements
document.addEventListener('DOMContentLoaded', () => {
    const revealElements = document.querySelectorAll(
        '.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-scale, .search-section, .feature-card-3d, .tech-showcase'
    );
    
    revealElements.forEach(el => {
        observer.observe(el);
    });
});

// 3D Tilt Effect for Feature Cards
document.querySelectorAll('[data-tilt]').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
    });
});

// Search Event Listeners
searchBtn.addEventListener('click', performSearch);
queryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        performSearch();
    }
});

// Format similarity score
function formatSimilarity(score) {
    return Math.round(score * 100) + '%';
}

// Create result card HTML
function createResultCard(result, index) {
    // Get content type and add emoji badge
    const contentType = result.content_type || 'text';
    const typeEmojis = {
        'text': '📝',
        'image': '📸',
        'sequence': '🧬',
        'experiment': '🔬'
    };
    const typeEmoji = typeEmojis[contentType] || '📄';
    
    return `
        <div class="result-card-3d" style="animation-delay: ${index * 0.1}s">
            <div class="result-header-3d">
                <h3 class="result-title-3d">${index + 1}. ${result.title || result.metadata?.title || 'Result'}</h3>
                <div class="similarity-badge">
                    ${typeEmoji} ${formatSimilarity(result.score || result.similarity_score || 0.5)}
                </div>
            </div>
            
            <div class="result-meta-3d">
                ${result.year || result.metadata?.year ? `<span><i class="far fa-calendar"></i> ${result.year || result.metadata.year}</span>` : ''}
                <span><i class="fas fa-tag"></i> ${contentType}</span>
                ${result.authors?.join ? `<span><i class="fas fa-users"></i> ${result.authors.join(', ')}</span>` : ''}
                ${result.journal ? `<span><i class="far fa-newspaper"></i> ${result.journal}</span>` : ''}
            </div>
            
            <p class="result-abstract-3d">${result.content || result.abstract || result.description || 'No content available'}</p>
            
            <div class="result-actions-3d">
                <button class="result-btn" onclick="viewPaperDetails('${result.id}')">
                    <i class="fas fa-external-link-alt"></i> View Details
                </button>
                <button class="result-btn" onclick="copyToClipboard('${result.id}')">
                    <i class="far fa-copy"></i> Copy Content
                </button>
                <button class="result-btn" onclick="showSimilarPapers('${result.id}')">
                    <i class="fas fa-project-diagram"></i> Find Similar
                </button>
            </div>
        </div>
    `;
}

// Display results with animation
function displayResults(results) {
    resultsHeader.style.display = 'flex';
    
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h4>No results found</h4>
                <p>Try a different search term or adjust your filters</p>
            </div>
        `;
        resultsStats.textContent = '0 results';
        return;
    }
    
    resultsContainer.innerHTML = results.map((result, index) => 
        createResultCard(result, index)
    ).join('');
    
    resultsStats.textContent = `${results.length} results`;
    
    // Scroll to results smoothly
    setTimeout(() => {
        resultsHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

// Show loading state
function setLoading(isLoading) {
    if (isLoading) {
        loadingIndicator.classList.add('active');
        resultsContainer.innerHTML = '';
        resultsHeader.style.display = 'none';
        searchBtn.disabled = true;
        searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Searching...</span>';
    } else {
        loadingIndicator.classList.remove('active');
        searchBtn.disabled = false;
        searchBtn.innerHTML = '<i class="fas fa-search"></i> <span>Search</span>';
    }
}

// Main search function
async function performSearch() {
    const query = queryInput.value.trim();
    
    if (!query) {
        queryInput.style.animation = 'shake 0.5s';
        setTimeout(() => {
            queryInput.style.animation = '';
        }, 500);
        queryInput.focus();
        return;
    }
    
    setLoading(true);
    
    const payload = {
        query: query,
        top_k: parseInt(resultsCount.value)
    };
    
    // Add year filter if selected
    if (yearFilter.value) {
        payload.year = parseInt(yearFilter.value);
    }
    
    // Add output type filter if selected
    if (outputTypeFilter.value) {
        payload.output_type = outputTypeFilter.value;
    }
    
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            const data = await response.json();
            await new Promise(resolve => setTimeout(resolve, 500));
            displayResults(data.results || data);
        } else {
            console.warn('API not available, using sample data');
            await simulateSearch();
        }
    } catch (error) {
        console.error('Search error:', error);
        await simulateSearch();
    } finally {
        setLoading(false);
    }
}

// Simulate search with sample data
async function simulateSearch() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    let filteredResults = SAMPLE_RESULTS.filter(result => {
        if (yearFilter.value && result.year !== parseInt(yearFilter.value)) {
            return false;
        }
        if (organismFilter.value && result.organism !== organismFilter.value) {
            return false;
        }
        return true;
    }).slice(0, parseInt(resultsCount.value));
    
    filteredResults = filteredResults.map(result => ({
        ...result,
        similarity_score: Math.min(0.95, Math.max(0.7, Math.random() * 0.3 + 0.65))
    }));
    
    filteredResults.sort((a, b) => b.similarity_score - a.similarity_score);
    
    displayResults(filteredResults);
}

// Add shake animation
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
        20%, 40%, 60%, 80% { transform: translateX(8px); }
    }
`;
document.head.appendChild(style);

// Example queries
const exampleQueries = [
    "CRISPR gene editing cancer therapy",
    "tumor suppressor proteins mutations",
    "canine lymphoma treatment",
    "feline kidney disease biomarkers",
    "immunotherapy veterinary medicine",
    "stem cell differentiation",
    "protein folding diseases"
];

// Rotate placeholder
function rotatePlaceholder() {
    if (document.activeElement !== queryInput && !queryInput.value) {
        const randomQuery = exampleQueries[Math.floor(Math.random() * exampleQueries.length)];
        queryInput.placeholder = `e.g., ${randomQuery}`;
    }
}

setInterval(rotatePlaceholder, 4000);

// Additional functions
function viewPaperDetails(paperId) {
    const paper = SAMPLE_RESULTS.find(p => p.id === paperId);
    if (paper) {
        alert(`📄 ${paper.title}

📅 Year: ${paper.year}
🧬 Organism: ${paper.organism || 'Not specified'}
👥 Authors: ${paper.authors?.join(', ') || 'Unknown'}
📰 Journal: ${paper.journal || 'Not specified'}
📊 Match: ${formatSimilarity(paper.similarity_score)}

📝 Abstract:
${paper.abstract}

This would open a detailed view in a real implementation.`);
    }
}

function copyToClipboard(paperId) {
    const paper = SAMPLE_RESULTS.find(p => p.id === paperId);
    if (!paper) return;
    
    const citation = `${paper.authors?.join(', ') || 'Authors'}. "${paper.title}". ${paper.journal || 'Journal'}, ${paper.year}.`;
    
    navigator.clipboard.writeText(citation)
        .then(() => {
            const button = event.target.closest('button');
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i> Copied!';
            button.style.background = 'linear-gradient(135deg, #10B981, #059669)';
            button.style.color = 'white';
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.style.background = '';
                button.style.color = '';
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy:', err);
        });
}

function showSimilarPapers(paperId) {
    const paper = SAMPLE_RESULTS.find(p => p.id === paperId);
    if (paper) {
        queryInput.value = paper.title.split(' ').slice(0, 3).join(' ');
        performSearch();
    }
}

// Mouse parallax effect on hero spheres
document.addEventListener('mousemove', (e) => {
    const spheres = document.querySelectorAll('.hero-sphere');
    const mouseX = e.clientX / window.innerWidth;
    const mouseY = e.clientY / window.innerHeight;
    
    spheres.forEach((sphere, index) => {
        const speed = (index + 1) * 20;
        const x = (mouseX - 0.5) * speed;
        const y = (mouseY - 0.5) * speed;
        sphere.style.transform = `translate(${x}px, ${y}px)`;
    });
});

// Floating shapes parallax
document.addEventListener('mousemove', (e) => {
    const shapes = document.querySelectorAll('.floating-shape');
    const mouseX = e.clientX / window.innerWidth;
    const mouseY = e.clientY / window.innerHeight;
    
    shapes.forEach((shape, index) => {
        const speed = (index + 1) * 15;
        const x = (mouseX - 0.5) * speed;
        const y = (mouseY - 0.5) * speed;
        shape.style.transform = `translate(${x}px, ${y}px)`;
    });
});

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    queryInput.placeholder = `e.g., ${exampleQueries[0]}`;
});
