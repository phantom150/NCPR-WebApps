document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            
            // Calculate mouse position inside the card
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Find the center of the card
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            // Calculate tilt (Max 15 degrees)
            const rotateX = ((y - centerY) / centerY) * -15;
            const rotateY = ((x - centerX) / centerX) * 15;

            // Apply the transformation
            requestAnimationFrame(() => {
                card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
            });
        });

        // Reset card on mouse leave
        card.addEventListener('mouseleave', () => {
            requestAnimationFrame(() => {
                card.style.transform = `rotateX(0deg) rotateY(0deg) scale(1)`;
            });
        });
    });
});