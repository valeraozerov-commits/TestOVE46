// Загрузка записей при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    loadAppointments();
    
    // Установка минимальной даты как сегодняшней
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').min = today;
    
    // Установка рабочих часов (9:00 - 21:00)
    document.getElementById('time').min = '09:00';
    document.getElementById('time').max = '21:00';
});

// Обработка формы записи
document.getElementById('bookingForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Валидация телефона
    const phone = document.getElementById('phone').value;
    if (!isValidPhone(phone)) {
        alert('Пожалуйста, введите корректный номер телефона');
        return;
    }
    
    const formData = {
        id: Date.now(), // Уникальный ID для каждой записи
        name: document.getElementById('name').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        email: document.getElementById('email').value.trim(),
        service: document.getElementById('service').value,
        date: document.getElementById('date').value,
        time: document.getElementById('time').value,
        notes: document.getElementById('notes').value.trim(),
        createdAt: new Date().toLocaleString('ru-RU')
    };
    
    saveAppointment(formData);
    this.reset();
    
    // Показать уведомление
    showNotification('Запись успешно добавлена!', 'success');
});

// Валидация телефона
function isValidPhone(phone) {
    const phoneRegex = /^[\+]?[78][-\s]?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{2}[-\s]?\d{2}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

// Сохранение записи в localStorage
function saveAppointment(appointment) {
    let appointments = JSON.parse(localStorage.getItem('manicureAppointments')) || [];
    appointments.push(appointment);
    localStorage.setItem('manicureAppointments', JSON.stringify(appointments));
    loadAppointments();
}

// Загрузка и отображение записей
function loadAppointments() {
    const appointments = JSON.parse(localStorage.getItem('manicureAppointments')) || [];
    const appointmentsList = document.getElementById('appointmentsList');
    
    if (appointments.length === 0) {
        appointmentsList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666;">
                <p>У вас пока нет записей</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">Записи появятся здесь после заполнения формы</p>
            </div>
        `;
        return;
    }
    
    // Сортируем записи по дате (сначала ближайшие)
    appointments.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
    
    appointmentsList.innerHTML = appointments.map((appointment) => `
        <div class="appointment-item">
            <h3>${getServiceName(appointment.service)}</h3>
            <p><strong>👤 Имя:</strong> ${appointment.name}</p>
            <p><strong>📞 Телефон:</strong> ${appointment.phone}</p>
            ${appointment.email ? `<p><strong>📧 Email:</strong> ${appointment.email}</p>` : ''}
            <p><strong>📅 Дата и время:</strong> ${formatDate(appointment.date)} в ${appointment.time}</p>
            ${appointment.notes ? `<p><strong>💭 Примечания:</strong> ${appointment.notes}</p>` : ''}
            <p style="font-size: 0.8rem; color: #888; margin-top: 0.5rem;">
                Запись создана: ${appointment.createdAt}
            </p>
            <button class="delete-btn" onclick="deleteAppointment(${appointment.id})">
                ❌ Отменить запись
            </button>
        </div>
    `).join('');
}

// Удаление записи
function deleteAppointment(id) {
    if (confirm('Вы уверены, что хотите отменить эту запись?')) {
        let appointments = JSON.parse(localStorage.getItem('manicureAppointments')) || [];
        appointments = appointments.filter(appointment => appointment.id !== id);
        localStorage.setItem('manicureAppointments', JSON.stringify(appointments));
        loadAppointments();
        showNotification('Запись отменена', 'info');
    }
}

// Показать уведомление
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : '#2196F3'};
        color: white;
        padding: 15px 20px;
        border-radius: 5px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Вспомогательные функции
function getServiceName(serviceCode) {
    const services = {
        'classic': '💅 Классический маникюр - 1500 руб.',
        'apparatus': '🔧 Аппаратный маникюр - 2000 руб.',
        'gel': '💎 Покрытие гель-лак - 1200 руб.',
        'design': '🎨 Дизайн ногтей - от 500 руб.'
    };
    return services[serviceCode] || 'Услуга';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Добавляем стили для анимации уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);