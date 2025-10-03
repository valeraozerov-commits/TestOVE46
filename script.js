// Конфигурация салона
const SALON_CONFIG = {
    workingHours: {
        start: 9,  // 9:00
        end: 21,   // 21:00
        break: { start: 13, end: 14 } // Обед 13:00-14:00
    },
    slotDuration: 30, // 30 минут
    masters: 1 // Количество мастеров
};

// Загрузка при запуске
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
    loadAppointments();
    setupEventListeners();
    loadTelegramConfig();
    
    // Установка минимальной даты
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').min = today;
    
    // Если сегодня воскресенье, пропускаем его
    const todayDate = new Date();
    if (todayDate.getDay() === 0) { // 0 = воскресенье
        todayDate.setDate(todayDate.getDate() + 1);
        document.getElementById('date').min = todayDate.toISOString().split('T')[0];
    }
}

function setupEventListeners() {
    // Изменение даты - обновляем доступное время
    document.getElementById('date').addEventListener('change', function() {
        updateTimeSlots();
    });
    
    // Изменение услуги - обновляем продолжительность
    document.getElementById('service').addEventListener('change', function() {
        updateTimeSlots();
    });
}

// Обновление доступных временных слотов
function updateTimeSlots() {
    const date = document.getElementById('date').value;
    const service = document.getElementById('service');
    const timeSelect = document.getElementById('time');
    const infoDiv = document.getElementById('timeSlotsInfo');
    
    if (!date || !service.value) {
        timeSelect.innerHTML = '<option value="">Сначала выберите дату и услугу</option>';
        infoDiv.innerHTML = '';
        return;
    }
    
    const selectedDate = new Date(date + 'T00:00:00');
    const dayOfWeek = selectedDate.getDay();
    
    // Проверяем воскресенье
    if (dayOfWeek === 0) {
        timeSelect.innerHTML = '<option value="">Выходной день</option>';
        infoDiv.innerHTML = '❌ Воскресенье - выходной день';
        return;
    }
    
    const serviceDuration = parseInt(service.options[service.selectedIndex].dataset.duration) || 60;
    const availableSlots = getAvailableTimeSlots(date, serviceDuration);
    
    timeSelect.innerHTML = '';
    
    if (availableSlots.length === 0) {
        timeSelect.innerHTML = '<option value="">Нет свободного времени</option>';
        infoDiv.innerHTML = '❌ На эту дату нет свободного времени';
    } else {
        timeSelect.innerHTML = '<option value="">Выберите время</option>';
        availableSlots.forEach(slot => {
            const option = document.createElement('option');
            option.value = slot.time;
            option.textContent = `${slot.time} (${slot.duration} мин)`;
            option.disabled = !slot.available;
            timeSelect.appendChild(option);
        });
        infoDiv.innerHTML = `✅ Доступно ${availableSlots.length} временных слотов`;
    }
}

// Получение доступных временных слотов
function getAvailableTimeSlots(date, duration) {
    const appointments = JSON.parse(localStorage.getItem('manicureAppointments')) || [];
    const dayAppointments = appointments.filter(apt => apt.date === date);
    
    const slots = [];
    const startHour = SALON_CONFIG.workingHours.start;
    const endHour = SALON_CONFIG.workingHours.end;
    const breakStart = SALON_CONFIG.workingHours.break.start;
    const breakEnd = SALON_CONFIG.workingHours.break.end;
    
    for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += SALON_CONFIG.slotDuration) {
            const slotTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const slotDateTime = new Date(`${date}T${slotTime}:00`);
            
            // Пропускаем обеденное время
            if (hour >= breakStart && hour < breakEnd) {
                continue;
            }
            
            // Проверяем, не выходит ли услуга за рабочие часы
            const endTime = new Date(slotDateTime.getTime() + duration * 60000);
            const endHour = endTime.getHours();
            const endMinute = endTime.getMinutes();
            
            if (endHour > SALON_CONFIG.workingHours.end || 
                (endHour === SALON_CONFIG.workingHours.end && endMinute > 0)) {
                continue;
            }
            
            // Проверяем пересечения с существующими записями
            const isAvailable = !dayAppointments.some(apt => {
                const aptStart = new Date(`${apt.date}T${apt.time}:00`);
                const aptEnd = new Date(aptStart.getTime() + (parseInt(apt.duration) || 60) * 60000);
                const slotEnd = new Date(slotDateTime.getTime() + duration * 60000);
                
                return (slotDateTime < aptEnd && slotEnd > aptStart);
            });
            
            slots.push({
                time: slotTime,
                duration: duration,
                available: isAvailable
            });
        }
    }
    
    return slots;
}

// Обработка формы записи
document.getElementById('bookingForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const phone = document.getElementById('phone').value;
    if (!isValidPhone(phone)) {
        showNotification('Пожалуйста, введите корректный номер телефона', 'error');
        return;
    }
    
    const serviceSelect = document.getElementById('service');
    const serviceDuration = serviceSelect.options[serviceSelect.selectedIndex].dataset.duration || '60';
    
    const formData = {
        id: Date.now(),
        name: document.getElementById('name').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        email: document.getElementById('email').value.trim(),
        service: document.getElementById('service').value,
        serviceName: serviceSelect.options[serviceSelect.selectedIndex].text,
        date: document.getElementById('date').value,
        time: document.getElementById('time').value,
        duration: serviceDuration,
        notes: document.getElementById('notes').value.trim(),
        createdAt: new Date().toLocaleString('ru-RU'),
        status: 'confirmed'
    };
    
    if (saveAppointment(formData)) {
        this.reset();
        showNotification('✅ Запись успешно добавлена!', 'success');
        sendTelegramNotification(formData);
    }
});

// Сохранение записи
function saveAppointment(appointment) {
    // Проверяем, не занято ли время
    const appointments = JSON.parse(localStorage.getItem('manicureAppointments')) || [];
    const isSlotOccupied = appointments.some(apt => 
        apt.date === appointment.date && 
        apt.time === appointment.time &&
        apt.status !== 'cancelled'
    );
    
    if (isSlotOccupied) {
        showNotification('❌ Это время уже занято! Пожалуйста, выберите другое время.', 'error');
        updateTimeSlots(); // Обновляем список времени
        return false;
    }
    
    appointments.push(appointment);
    localStorage.setItem('manicureAppointments', JSON.stringify(appointments));
    loadAppointments();
    return true;
}

// Загрузка записей
function loadAppointments() {
    const appointments = JSON.parse(localStorage.getItem('manicureAppointments')) || [];
    const appointmentsList = document.getElementById('appointmentsList');
    
    // Фильтруем только активные записи
    const activeAppointments = appointments.filter(apt => apt.status !== 'cancelled');
    
    if (activeAppointments.length === 0) {
        appointmentsList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666;">
                <p>Записей пока нет</p>
            </div>
        `;
        return;
    }
    
    // Сортируем по дате и времени
    activeAppointments.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
    
    appointmentsList.innerHTML = activeAppointments.map(appointment => `
        <div class="appointment-item">
            <h3>${getServiceName(appointment.service)}</h3>
            <p><strong>👤 Клиент:</strong> ${appointment.name}</p>
            <p><strong>📞 Телефон:</strong> ${appointment.phone}</p>
            ${appointment.email ? `<p><strong>📧 Email:</strong> ${appointment.email}</p>` : ''}
            <p><strong>📅 Дата:</strong> ${formatDate(appointment.date)}</p>
            <p><strong>⏰ Время:</strong> ${appointment.time} (${appointment.duration} мин)</p>
            ${appointment.notes ? `<p><strong>💭 Примечания:</strong> ${appointment.notes}</p>` : ''}
            <p><strong>📝 Статус:</strong> <span class="status-${appointment.status}">${getStatusText(appointment.status)}</span></p>
            <p style="font-size: 0.8rem; color: #888; margin-top: 0.5rem;">
                Создана: ${appointment.createdAt}
            </p>
            <button class="delete-btn" onclick="cancelAppointment(${appointment.id})">
                ❌ Отменить запись
            </button>
        </div>
    `).join('');
}

// Отмена записи
function cancelAppointment(id) {
    if (confirm('Вы уверены, что хотите отменить эту запись?')) {
        let appointments = JSON.parse(localStorage.getItem('manicureAppointments')) || [];
        const appointmentIndex = appointments.findIndex(apt => apt.id === id);
        
        if (appointmentIndex !== -1) {
            appointments[appointmentIndex].status = 'cancelled';
            appointments[appointmentIndex].cancelledAt = new Date().toLocaleString('ru-RU');
            localStorage.setItem('manicureAppointments', JSON.stringify(appointments));
            loadAppointments();
            showNotification('Запись отменена', 'info');
        }
    }
}

// Telegram уведомления
function loadTelegramConfig() {
    const config = JSON.parse(localStorage.getItem('telegramConfig')) || {};
    document.getElementById('telegramBotToken').value = config.botToken || '';
    document.getElementById('telegramChatId').value = config.chatId || '';
}

function saveTelegramConfig() {
    const config = {
        botToken: document.getElementById('telegramBotToken').value.trim(),
        chatId: document.getElementById('telegramChatId').value.trim()
    };
    
    localStorage.setItem('telegramConfig', JSON.stringify(config));
    showNotification('Настройки Telegram сохранены', 'success');
}

async function sendTelegramNotification(appointment) {
    const config = JSON.parse(localStorage.getItem('telegramConfig')) || {};
    
    if (!config.botToken || !config.chatId) {
        console.log('Telegram не настроен');
        return;
    }
    
    const message = `📅 Новая запись на маникюр!

👤 Клиент: ${appointment.name}
📞 Телефон: ${appointment.phone}
${appointment.email ? `📧 Email: ${appointment.email}\n` : ''}
💅 Услуга: ${appointment.serviceName}
📅 Дата: ${formatDate(appointment.date)}
⏰ Время: ${appointment.time} (${appointment.duration} мин)
${appointment.notes ? `💭 Примечания: ${appointment.notes}\n` : ''}
🆔 ID записи: ${appointment.id}
⏱ Создана: ${appointment.createdAt}`;

    try {
        const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: config.chatId,
                text: message,
                parse_mode: 'HTML'
            })
        });
        
        const result = await response.json();
        if (result.ok) {
            console.log('Уведомление отправлено в Telegram');
        } else {
            console.error('Ошибка отправки в Telegram:', result);
        }
    } catch (error) {
        console.error('Ошибка отправки уведомления:', error);
    }
}

// Экспорт записей
function exportAppointments() {
    const appointments = JSON.parse(localStorage.getItem('manicureAppointments')) || [];
    const dataStr = JSON.stringify(appointments, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `appointments-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

function clearAllAppointments() {
    if (confirm('Вы уверены, что хотите удалить ВСЕ записи? Это действие нельзя отменить!')) {
        localStorage.removeItem('manicureAppointments');
        loadAppointments();
        showNotification('Все записи удалены', 'info');
    }
}

// Вспомогательные функции
function isValidPhone(phone) {
    const phoneRegex = /^[\+]?[78][-\s]?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{2}[-\s]?\d{2}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

function getServiceName(serviceCode) {
    const services = {
        'classic': '💅 Классический маникюр',
        'apparatus': '🔧 Аппаратный маникюр', 
        'gel': '💎 Покрытие гель-лак',
        'design': '🎨 Дизайн ногтей'
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

function getStatusText(status) {
    const statuses = {
        'confirmed': '✅ Подтверждена',
        'cancelled': '❌ Отменена',
        'completed': '✅ Выполнена'
    };
    return statuses[status] || status;
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
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
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Добавляем стили для анимаций
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
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    .status-confirmed { color: #4CAF50; font-weight: bold; }
    .status-cancelled { color: #f44336; font-weight: bold; }
    .status-completed { color: #2196F3; font-weight: bold; }
`;
document.head.appendChild(style);