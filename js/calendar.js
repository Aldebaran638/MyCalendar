// 全局变量
var calendar;
var selectedColor = '#3788d8'; // 默认颜色
var eventTitle = ''; // 预设事件名称
var selectedEvent = null; // 当前选中的事件
var isEditingMode = false; // 是否处于编辑模式
var pendingTitle = ''; // 待更新的标题
var pendingColor = ''; // 待更新的颜色
var isShowingEditDialog = false; // 标记是否正在显示编辑对话框

// 重复事件相关变量
var selectedRepeatFrequency = 'none'; // 重复频率
var selectedRepeatCount = 10; // 重复次数

// 撤回/复原系统
var operationHistory = []; // 操作历史栈
var currentHistoryIndex = -1; // 当前历史位置
var maxHistorySize = 50; // 最大历史记录数量
var isUndoRedoOperation = false; // 标记是否正在执行撤回/复原操作

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
  initializeCalendar();
  initializeControls();
  updateUndoRedoButtons(); // 初始化按钮状态
  initializeClock(); // 初始化时钟显示
});

/**
 * 初始化时钟显示
 */
function initializeClock() {
  function updateClock() {
    const now = new Date();
    
    // 更新时间显示
    const timeString = now.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    // 更新日期显示
    const dateString = now.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const timeElement = document.getElementById('currentTime');
    const dateElement = document.getElementById('currentDate');
    
    if (timeElement) {
      timeElement.textContent = timeString;
    }
    
    if (dateElement) {
      dateElement.textContent = dateString;
    }
  }
  
  // 立即更新一次
  updateClock();
  
  // 每秒更新
  setInterval(updateClock, 1000);
}

/**
 * 初始化日历
 */
function initializeCalendar() {
  var calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    
    // 头部工具栏配置
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    
    // 启用交互功能
    selectable: true,
    editable: true,
    
    // 事件显示配置
    eventDisplay: 'block', // 确保事件以块状显示
    dayMaxEvents: false, // 不限制每天显示的事件数量
    eventOverlap: true, // 允许事件重叠
    slotEventOverlap: true, // 在时间视图中允许事件重叠
    
    // 点击日期添加事件
    select: function(info) {
      addNewEvent(info);
    },
    
    // 点击事件进行编辑或删除
    eventClick: function(info) {
      handleEventClick(info);
    },
    
    // 拖拽和调整事件后保存
    eventDrop: function(info) {
      // 记录拖拽操作到历史
      if (!isUndoRedoOperation) {
        var oldData = {
          id: info.event.id,
          title: info.oldEvent.title,
          start: info.oldEvent.start ? info.oldEvent.start.toISOString() : null,
          end: info.oldEvent.end ? info.oldEvent.end.toISOString() : null,
          allDay: info.oldEvent.allDay,
          backgroundColor: info.oldEvent.backgroundColor,
          borderColor: info.oldEvent.borderColor
        };
        recordOperation('move', info.event, oldData);
      }
      saveEvents();
    },
    
    eventResize: function(info) {
      // 记录调整大小操作到历史
      if (!isUndoRedoOperation) {
        var oldData = {
          id: info.event.id,
          title: info.oldEvent.title,
          start: info.oldEvent.start ? info.oldEvent.start.toISOString() : null,
          end: info.oldEvent.end ? info.oldEvent.end.toISOString() : null,
          allDay: info.oldEvent.allDay,
          backgroundColor: info.oldEvent.backgroundColor,
          borderColor: info.oldEvent.borderColor
        };
        recordOperation('resize', info.event, oldData);
      }
      saveEvents();
    },
    
    // 加载保存的事件
    events: loadEvents()
  });
  
  calendar.render();
}

/**
 * 初始化控制面板
 */
function initializeControls() {
  // 设置默认选中的颜色
  selectColor('#3788d8');
  
  // 监听事件名称输入
  var eventTitleInput = document.getElementById('eventTitleInput');
  if (eventTitleInput) {
    // 输入时只更新待处理的标题，不立即更新事件
    eventTitleInput.addEventListener('input', function() {
      var newTitle = this.value.trim();
      console.log('🎯 输入框变化:', newTitle);
      
      if (isEditingMode && selectedEvent) {
        // 编辑模式下，暂存标题，不立即更新事件
        pendingTitle = newTitle || '新事件';
        console.log('📝 暂存标题:', pendingTitle);
        eventTitle = newTitle;
      } else {
        // 非编辑模式下，只更新全局变量
        eventTitle = newTitle;
      }
      
      updatePreview();
    });
    
    // 回车键提交更改
    eventTitleInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && isEditingMode && selectedEvent) {
        console.log('⏎ 回车提交更改');
        applyPendingChanges();
        this.blur(); // 移除焦点
      }
    });
    
    // 失去焦点时提交更改
    eventTitleInput.addEventListener('blur', function() {
      if (isEditingMode && selectedEvent) {
        console.log('� 失去焦点，提交更改');
        applyPendingChanges();
      }
    });
  }
  
  // 监听重复频率选择
  var repeatFrequencySelect = document.getElementById('repeatFrequency');
  if (repeatFrequencySelect) {
    repeatFrequencySelect.addEventListener('change', function() {
      selectedRepeatFrequency = this.value;
      var repeatCountGroup = document.getElementById('repeatCountGroup');
      if (repeatCountGroup) {
        if (selectedRepeatFrequency === 'none') {
          repeatCountGroup.style.display = 'none';
        } else {
          repeatCountGroup.style.display = 'flex';
        }
      }
    });
  }
  
  // 监听重复次数输入
  var repeatCountInput = document.getElementById('repeatCount');
  if (repeatCountInput) {
    repeatCountInput.addEventListener('input', function() {
      selectedRepeatCount = parseInt(this.value) || 10;
    });
  }
  
  // 监听键盘事件
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Backspace' && selectedEvent && isEditingMode) {
      // 检查是否在输入框中
      if (document.activeElement !== eventTitleInput) {
        console.log('🗑️ 删除选中事件:', selectedEvent.id);
        
        // 保存当前选中事件的ID，防止在对话框显示期间事件被清空
        var eventToDelete = selectedEvent;
        var eventId = selectedEvent.id;
        
        // 显示重复事件删除对话框
        showRepeatDeleteDialog(eventToDelete, function(deleteOptions) {
          // 在回调中重新验证事件是否仍然存在
          var currentEvent = calendar.getEventById(eventId);
          if (currentEvent) {
            deleteRepeatEvents(currentEvent, deleteOptions);
          } else {
            console.log('⚠️ 事件已被删除或不存在，取消删除操作');
          }
        });
      }
    } else if (e.key === 'Escape' && isEditingMode) {
      // ESC键退出编辑模式
      exitEditingMode();
    } else if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      // Ctrl+Z 撤回
      e.preventDefault();
      undo();
    } else if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      // Ctrl+Y 或 Ctrl+Shift+Z 复原
      e.preventDefault();
      redo();
    }
  });
  
  // 监听日历空白区域点击，退出编辑模式
  document.addEventListener('click', function(e) {
    if (isEditingMode && !e.target.closest('.fc-event') && !e.target.closest('.control-panel') && !e.target.closest('.modal')) {
      console.log('👆 点击空白区域，退出编辑模式');
      applyPendingChanges();
      exitEditingMode();
    }
  });
}

/**
 * 添加新事件
 */
function addNewEvent(info) {
  var title;
  
  // 如果有预设的事件名称，使用预设名称，否则使用默认的"新事件"
  if (eventTitle && eventTitle.trim()) {
    title = eventTitle.trim();
  } else {
    title = '新事件';
  }
  
  // 添加重复标识到标题
  var displayTitle = title;
  if (selectedRepeatFrequency !== 'none') {
    var repeatLabel = getRepeatLabel(selectedRepeatFrequency);
    displayTitle = `🔁 ${title} (${repeatLabel})`;
  }
  
  // 创建基础事件数据
  var baseEvent = {
    title: displayTitle,
    start: info.start,
    end: info.end,
    allDay: info.allDay,
    backgroundColor: selectedColor,
    borderColor: selectedColor,
    extendedProps: {
      originalTitle: title,
      repeatFrequency: selectedRepeatFrequency,
      repeatCount: selectedRepeatCount,
      seriesId: Date.now().toString() // 重复系列ID
    }
  };
  
  var addedEvents = [];
  
  if (selectedRepeatFrequency === 'none') {
    // 单个事件
    baseEvent.id = Date.now().toString();
    var addedEvent = calendar.addEvent(baseEvent);
    addedEvents.push(addedEvent);
  } else {
    // 重复事件
    var events = generateRepeatEvents(baseEvent, selectedRepeatCount);
    events.forEach(function(eventData) {
      var addedEvent = calendar.addEvent(eventData);
      addedEvents.push(addedEvent);
    });
  }
  
  // 记录添加操作到历史
  if (!isUndoRedoOperation) {
    recordOperation('add', addedEvents[0], null, addedEvents);
  }
  
  saveEvents();
  calendar.unselect();
}

/**
 * 处理事件点击
 */
function handleEventClick(info) {
  console.log('🖱️ 点击事件:', info.event.id, info.event.title);
  
  // 取消之前选中的事件
  if (selectedEvent) {
    console.log('🔄 取消之前选中的事件:', selectedEvent.id);
    selectedEvent.setProp('classNames', selectedEvent.classNames.filter(name => name !== 'selected'));
  }
  
  // 选中当前事件
  selectedEvent = info.event;
  selectedEvent.setProp('classNames', [...selectedEvent.classNames, 'selected']);
  console.log('✅ 选中新事件:', selectedEvent.id, selectedEvent.title);
  
  // 进入编辑模式
  enterEditingMode(selectedEvent);
}

/**
 * 设置透明度预览（拖动时实时预览，不触发编辑完成）
 */
function setOpacityPreview(opacity) {
  selectedOpacity = opacity;
  
  // 更新滑动条和输入框的值
  var opacitySlider = document.getElementById('opacitySlider');
  var opacityInput = document.getElementById('opacityInput');
  
  if (opacitySlider) {
    opacitySlider.value = opacity;
  }
  
  if (opacityInput) {
    opacityInput.value = opacity.toFixed(2);
  }
  
  // 如果处于编辑模式，实时更新事件的视觉效果，但不暂存到pending状态
  if (isEditingMode && selectedEvent) {
    console.log('�️ 透明度实时预览:', opacity);
    var color = pendingColor || selectedColor;
    var rgba = hexToRgba(color, opacity);
    
    // 直接更新事件的显示，但不记录为待处理的更改
    selectedEvent.setProp('backgroundColor', rgba);
    
    // 同时更新扩展属性，但这只是临时的
    if (!selectedEvent.extendedProps) {
      selectedEvent.extendedProps = {};
    }
    selectedEvent.extendedProps.opacity = opacity;
  }
  
  updatePreview();
}

/**
 * 设置透明度最终值（停止拖动时触发编辑完成）
 */
function setOpacityFinal(opacity) {
  selectedOpacity = opacity;
  
  // 更新滑动条和输入框的值
  var opacitySlider = document.getElementById('opacitySlider');
  var opacityInput = document.getElementById('opacityInput');
  
  if (opacitySlider) {
    opacitySlider.value = opacity;
  }
  
  if (opacityInput) {
    opacityInput.value = opacity.toFixed(2);
  }
  
  // 如果处于编辑模式，暂存透明度变更并触发编辑完成
  if (isEditingMode && selectedEvent) {
    console.log('🔍 透明度最终提交:', opacity);
    pendingOpacity = opacity;
    // 触发编辑完成
    applyPendingChanges();
  }
  
  updatePreview();
}

/**
 * 设置透明度（保留原有函数，用于非编辑模式）
 */
function setOpacity(opacity) {
  selectedOpacity = opacity;
  
  // 更新滑动条和输入框的值
  var opacitySlider = document.getElementById('opacitySlider');
  var opacityInput = document.getElementById('opacityInput');
  
  if (opacitySlider) {
    opacitySlider.value = opacity;
  }
  
  if (opacityInput) {
    opacityInput.value = opacity.toFixed(2);
  }
  
  updatePreview();
}

/**
 * 选择颜色（立即应用）
 */
function selectColor(color) {
  selectedColor = color;
  
  // 更新视觉状态
  document.querySelectorAll('.color-option').forEach(option => {
    option.classList.remove('selected');
  });
  
  var selectedOption = document.querySelector(`[data-color="${color}"]`);
  if (selectedOption) {
    selectedOption.classList.add('selected');
  }
  
  // 如果处于编辑模式，暂存颜色变更并触发编辑完成
  if (isEditingMode && selectedEvent) {
    console.log('🎨 颜色变更并立即提交:', color);
    
    // 直接更新事件颜色
    selectedEvent.setProp('backgroundColor', color);
    selectedEvent.setProp('borderColor', color);
    
    // 暂存颜色变更并触发编辑完成
    pendingColor = color;
    applyPendingChanges();
  }
  
  updatePreview();
}

/**
 * 更新预览效果
 */
function updatePreview() {
  var previewEvent = document.getElementById('previewEvent');
  if (previewEvent) {
    var displayTitle = eventTitle || '新事件';
    previewEvent.textContent = displayTitle;
    
    // 应用颜色
    var color = selectedColor;
    
    previewEvent.style.backgroundColor = color;
    previewEvent.style.borderColor = color;
  }
}

/**
 * 进入编辑模式
 */
function enterEditingMode(event) {
  console.log('🔄 进入编辑模式，事件ID:', event.id, '标题:', event.title);
  
  isEditingMode = true;
  
  // 更新预设区显示选中事件的信息
  // 对于重复事件，显示原始标题（不含重复标识）
  var displayTitle = event.title || '';
  if (event.extendedProps?.originalTitle) {
    displayTitle = event.extendedProps.originalTitle;
  } else if (event.title && event.title.startsWith('🔁 ')) {
    // 如果标题以重复标识开头，尝试提取原始标题
    var match = event.title.match(/^🔁\s+(.+?)\s+\(.+\)$/);
    if (match) {
      displayTitle = match[1];
    }
  }
  
  eventTitle = displayTitle;
  selectedColor = event.backgroundColor || '#3788d8';
  
  // 初始化待处理的变更
  pendingTitle = eventTitle;
  pendingColor = selectedColor;
  
  console.log('📝 设置编辑参数 - 标题:', eventTitle, '颜色:', selectedColor);
  
  // 更新输入框
  var eventTitleInput = document.getElementById('eventTitleInput');
  if (eventTitleInput) {
    eventTitleInput.value = eventTitle;
  }
  
  // 更新颜色选择（不触发事件更新）
  updateColorSelection(selectedColor);
  
  // 禁用重复频率控件（编辑模式下不允许修改重复设置）
  var repeatFrequencySelect = document.getElementById('repeatFrequency');
  var repeatCountInput = document.getElementById('repeatCount');
  var repeatCountGroup = document.getElementById('repeatCountGroup');
  
  if (repeatFrequencySelect) {
    repeatFrequencySelect.disabled = true;
    repeatFrequencySelect.style.opacity = '0.5';
    repeatFrequencySelect.style.cursor = 'not-allowed';
    
    // 显示当前事件的重复设置（如果有的话）
    var currentRepeatFrequency = event.extendedProps?.repeatFrequency || 'none';
    repeatFrequencySelect.value = currentRepeatFrequency;
  }
  
  if (repeatCountInput) {
    repeatCountInput.disabled = true;
    repeatCountInput.style.opacity = '0.5';
    repeatCountInput.style.cursor = 'not-allowed';
    
    // 显示当前事件的重复次数
    var currentRepeatCount = event.extendedProps?.repeatCount || 10;
    repeatCountInput.value = currentRepeatCount;
  }
  
  if (repeatCountGroup) {
    var currentRepeatFrequency = event.extendedProps?.repeatFrequency || 'none';
    if (currentRepeatFrequency === 'none') {
      repeatCountGroup.style.display = 'none';
    } else {
      repeatCountGroup.style.display = 'flex';
    }
  }
  
  // 更新预览区样式
  var previewSection = document.querySelector('.preview-section');
  if (previewSection) {
    previewSection.classList.add('editing');
  }
  
  // 更新预览文本
  var previewText = document.querySelector('.preview-text');
  if (previewText) {
    previewText.textContent = '正在编辑事件：';
  }
  
  updatePreview();
  
  console.log('✅ 编辑模式初始化完成');
}

/**
 * 只更新颜色选择视觉状态，不触发事件更新
 */
function updateColorSelection(color) {
  selectedColor = color;
  
  // 更新视觉状态
  document.querySelectorAll('.color-option').forEach(option => {
    option.classList.remove('selected');
  });
  
  var selectedOption = document.querySelector(`[data-color="${color}"]`);
  if (selectedOption) {
    selectedOption.classList.add('selected');
  }
}

/**
 * 应用待处理的更改到选中的事件
 */
function applyPendingChanges() {
  if (!isEditingMode || !selectedEvent) {
    console.log('🚫 非编辑模式或无选中事件，跳过应用更改');
    return;
  }
  
  // 如果正在显示编辑对话框，跳过处理
  if (isShowingEditDialog) {
    console.log('⏳ 正在显示编辑对话框，跳过重复处理');
    return;
  }
  
  try {
    // 检查事件是否还存在
    var allEvents = calendar.getEvents();
    var eventExists = allEvents.find(e => e.id === selectedEvent.id);
    
    if (!eventExists) {
      console.error('❌ 事件已不存在，强制退出编辑模式');
      forceExitEditingMode();
      return;
    }
    
    var hasChanges = false;
    var changes = {};
    
    // 检查标题更改
    console.log('🔍 检查标题更改:');
    console.log('  - pendingTitle:', pendingTitle);
    console.log('  - selectedEvent.title:', selectedEvent.title);
    console.log('  - selectedEvent.extendedProps?.originalTitle:', selectedEvent.extendedProps?.originalTitle);
    
    // 对于重复事件，应该与原始标题比较，而不是显示标题
    var currentTitle = selectedEvent.extendedProps?.originalTitle || selectedEvent.title;
    if (currentTitle.startsWith('🔁 ')) {
      var match = currentTitle.match(/^🔁\s+(.+?)\s+\(.+\)$/);
      if (match) {
        currentTitle = match[1];
      }
    }
    
    if (pendingTitle && pendingTitle !== currentTitle) {
      changes.title = pendingTitle;
      hasChanges = true;
      console.log('  ✅ 标题有变更:', currentTitle, '→', pendingTitle);
    } else {
      console.log('  ❌ 标题无变更');
    }
    
    // 检查颜色更改
    console.log('🔍 检查颜色更改:');
    console.log('  - pendingColor:', pendingColor);
    console.log('  - selectedEvent.backgroundColor:', selectedEvent.backgroundColor);
    
    if (pendingColor && pendingColor !== selectedColor) {
      changes.color = pendingColor;
      hasChanges = true;
      console.log('  ✅ 颜色有变更:', selectedColor, '→', pendingColor);
    } else {
      console.log('  ❌ 颜色无变更');
    }
    
    if (!hasChanges) {
      console.log('📝 没有待处理的更改');
      return;
    }
    
    // 检查是否为重复事件
    var seriesId = selectedEvent.extendedProps?.seriesId;
    var repeatFrequency = selectedEvent.extendedProps?.repeatFrequency;
    
    if (seriesId && repeatFrequency !== 'none') {
      // 重复事件，显示编辑选择对话框
      console.log('🔄 重复事件，显示编辑选择对话框');
      
      // 保存当前选中事件的引用，防止在对话框期间被清空
      var eventToEdit = selectedEvent;
      var eventId = selectedEvent.id;
      
      isShowingEditDialog = true; // 设置标志，防止重复弹出
      showRepeatEditDialog(selectedEvent, changes, function(editOptions) {
        isShowingEditDialog = false; // 重置标志
        
        // 在回调中重新验证事件是否仍然存在
        var currentEvent = calendar.getEventById(eventId);
        if (currentEvent && eventToEdit) {
          applyRepeatEventEdit(currentEvent, changes, editOptions);
          // 清空待处理的更改，避免状态不一致
          pendingTitle = '';
          pendingColor = '';
          console.log('🧹 清空待处理的更改');
        } else {
          console.log('⚠️ 事件已被删除或不存在，取消编辑操作');
        }
      });
    } else {
      // 普通事件，直接应用更改
      console.log('📝 普通事件，直接应用更改');
      
      var oldData = {
        id: selectedEvent.id,
        title: selectedEvent.title,
        backgroundColor: selectedEvent.backgroundColor,
        borderColor: selectedEvent.borderColor
      };
      
      // 应用标题更改
      if (changes.title) {
        console.log('📝 应用标题更改:', selectedEvent.title, '→', changes.title);
        selectedEvent.setProp('title', changes.title);
      }
      
      // 应用颜色更改
      if (changes.color) {
        console.log('🎨 应用颜色更改:', selectedEvent.backgroundColor, '→', changes.color);
        selectedEvent.setProp('backgroundColor', changes.color);
        selectedEvent.setProp('borderColor', changes.color);
      }
      
      // 记录操作历史并保存
      if (!isUndoRedoOperation) {
        console.log('💾 保存更改到本地存储');
        recordOperation('edit', selectedEvent, oldData);
        saveEvents();
      }
    }
    
  } catch (error) {
    console.error('❌ 应用更改时出错:', error);
    // 发生错误时也强制退出编辑模式
    forceExitEditingMode();
  }
}

/**
 * 退出编辑模式
 */
function exitEditingMode() {
  console.log('🚪 退出编辑模式');
  
  // 如果正在显示编辑对话框，不要立即退出编辑模式
  if (isShowingEditDialog) {
    console.log('⏳ 正在显示编辑对话框，延迟退出编辑模式');
    return;
  }
  
  // 在退出前应用所有待处理的更改
  applyPendingChanges();
  
  isEditingMode = false;
  isShowingEditDialog = false; // 重置对话框标志
  
  // 清空待处理的更改
  pendingTitle = '';
  pendingColor = '';
  
  // 取消选中状态
  if (selectedEvent) {
    selectedEvent.setProp('classNames', selectedEvent.classNames.filter(name => name !== 'selected'));
    selectedEvent = null;
  }
  
  // 重新启用重复频率控件
  var repeatFrequencySelect = document.getElementById('repeatFrequency');
  var repeatCountInput = document.getElementById('repeatCount');
  var repeatCountGroup = document.getElementById('repeatCountGroup');
  
  if (repeatFrequencySelect) {
    repeatFrequencySelect.disabled = false;
    repeatFrequencySelect.style.opacity = '1';
    repeatFrequencySelect.style.cursor = 'pointer';
    repeatFrequencySelect.value = 'none'; // 重置为默认值
  }
  
  if (repeatCountInput) {
    repeatCountInput.disabled = false;
    repeatCountInput.style.opacity = '1';
    repeatCountInput.style.cursor = 'text';
    repeatCountInput.value = '10'; // 重置为默认值
  }
  
  if (repeatCountGroup) {
    repeatCountGroup.style.display = 'none'; // 隐藏重复次数组
  }
  
  // 恢复预设区样式
  var previewSection = document.querySelector('.preview-section');
  if (previewSection) {
    previewSection.classList.remove('editing');
  }
  
  // 恢复预览文本
  var previewText = document.querySelector('.preview-text');
  if (previewText) {
    previewText.textContent = '新事件将显示为：';
  }
  
  // 清空输入框
  var eventTitleInput = document.getElementById('eventTitleInput');
  if (eventTitleInput) {
    eventTitleInput.value = '';
  }
  
  // 重置为默认状态
  eventTitle = '';
  selectedColor = '#3788d8';
  selectedRepeatFrequency = 'none';
  selectedRepeatCount = 10;
  selectColor('#3788d8');
  
  console.log('✅ 编辑模式退出完成');
}

/**
 * 强制退出编辑模式（用于事件被删除等特殊情况）
 */
function forceExitEditingMode() {
  console.log('🚪 强制退出编辑模式（事件已删除）');
  
  // 直接重置所有状态，不尝试应用更改
  isEditingMode = false;
  selectedEvent = null;
  isShowingEditDialog = false; // 重置对话框标志
  
  // 清空待处理的更改
  pendingTitle = '';
  pendingColor = '';
  
  // 重新启用重复频率控件
  var repeatFrequencySelect = document.getElementById('repeatFrequency');
  var repeatCountInput = document.getElementById('repeatCount');
  var repeatCountGroup = document.getElementById('repeatCountGroup');
  
  if (repeatFrequencySelect) {
    repeatFrequencySelect.disabled = false;
    repeatFrequencySelect.style.opacity = '1';
    repeatFrequencySelect.style.cursor = 'pointer';
    repeatFrequencySelect.value = 'none'; // 重置为默认值
  }
  
  if (repeatCountInput) {
    repeatCountInput.disabled = false;
    repeatCountInput.style.opacity = '1';
    repeatCountInput.style.cursor = 'text';
    repeatCountInput.value = '10'; // 重置为默认值
  }
  
  if (repeatCountGroup) {
    repeatCountGroup.style.display = 'none'; // 隐藏重复次数组
  }
  
  // 恢复预设区样式
  var previewSection = document.querySelector('.preview-section');
  if (previewSection) {
    previewSection.classList.remove('editing');
  }
  
  // 恢复预览文本
  var previewText = document.querySelector('.preview-text');
  if (previewText) {
    previewText.textContent = '新事件将显示为：';
  }
  
  // 清空输入框
  var eventTitleInput = document.getElementById('eventTitleInput');
  if (eventTitleInput) {
    eventTitleInput.value = '';
  }
  
  // 重置为默认状态
  eventTitle = '';
  selectedColor = '#3788d8';
  selectedRepeatFrequency = 'none';
  selectedRepeatCount = 10;
  selectColor('#3788d8');
  
  console.log('✅ 强制退出编辑模式完成');
}

/**
 * 保存事件到本地存储
 */
function saveEvents() {
  if (!calendar) {
    console.log('❌ calendar未初始化，跳过保存');
    return;
  }
  
  try {
    var allEvents = calendar.getEvents();
    console.log('💾 准备保存', allEvents.length, '个事件');
    
    var events = allEvents.map(function(event) {
      var eventData = {
        id: event.id,
        title: event.title || '新事件',
        start: event.start.toISOString(),
        end: event.end ? event.end.toISOString() : null,
        allDay: event.allDay,
        backgroundColor: event.backgroundColor || '#3788d8',
        borderColor: event.borderColor || '#3788d8'
      };
      
      // 保存扩展属性（包括重复事件信息）
      if (event.extendedProps && Object.keys(event.extendedProps).length > 0) {
        eventData.extendedProps = event.extendedProps;
      }
      
      console.log('📋 事件数据:', eventData.id, eventData.title, eventData.extendedProps ? '(含扩展属性)' : '(普通事件)');
      return eventData;
    });
    
    localStorage.setItem('myCalendarEvents', JSON.stringify(events));
    console.log('✅ 事件保存成功:', events.length, '个');
    
    // 验证保存的数据
    var saved = localStorage.getItem('myCalendarEvents');
    var parsed = JSON.parse(saved);
    console.log('🔍 验证保存的数据:', parsed.length, '个事件');
    
  } catch (error) {
    console.error('❌ 保存事件时出错:', error);
  }
}

/**
 * 从本地存储加载事件
 */
function loadEvents() {
  var savedEvents = localStorage.getItem('myCalendarEvents');
  if (savedEvents) {
    var events = JSON.parse(savedEvents);
    console.log('加载了', events.length, '个事件');
    return events;
  } else {
    console.log('没有保存的事件');
    return [];
  }
}

/**
 * 导出功能（可选扩展）
 */
function exportEvents() {
  var events = calendar.getEvents().map(function(event) {
    return {
      title: event.title,
      start: event.start.toISOString(),
      end: event.end ? event.end.toISOString() : null,
      allDay: event.allDay,
      backgroundColor: event.backgroundColor
    };
  });
  
  var dataStr = JSON.stringify(events, null, 2);
  var dataBlob = new Blob([dataStr], {type:'application/json'});
  var url = URL.createObjectURL(dataBlob);
  var link = document.createElement('a');
  link.href = url;
  link.download = 'calendar-events.json';
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * 记录操作到历史栈
 */
function recordOperation(type, event, oldData, allEvents) {
  if (isUndoRedoOperation) {
    return; // 避免在撤回/复原操作中记录新的历史
  }
  
  var operation = {
    type: type, // 'add', 'edit', 'delete'
    timestamp: Date.now(),
    eventData: {
      id: event.id,
      title: event.title,
      start: event.start ? event.start.toISOString() : null,
      end: event.end ? event.end.toISOString() : null,
      allDay: event.allDay,
      backgroundColor: event.backgroundColor,
      borderColor: event.borderColor,
      extendedProps: event.extendedProps
    }
  };
  
  // 对于编辑操作，还需要保存原始数据
  if (type === 'edit' && oldData) {
    operation.oldData = oldData;
  }
  
  // 对于重复事件，保存所有相关事件
  if (allEvents && allEvents.length > 1) {
    operation.allEvents = allEvents.map(e => ({
      id: e.id,
      title: e.title,
      start: e.start ? e.start.toISOString() : null,
      end: e.end ? e.end.toISOString() : null,
      allDay: e.allDay,
      backgroundColor: e.backgroundColor,
      borderColor: e.borderColor,
      extendedProps: e.extendedProps
    }));
  }
  
  // 清除当前位置之后的历史（如果用户在历史中间进行了新操作）
  if (currentHistoryIndex < operationHistory.length - 1) {
    operationHistory = operationHistory.slice(0, currentHistoryIndex + 1);
  }
  
  // 添加新操作到历史
  operationHistory.push(operation);
  currentHistoryIndex++;
  
  // 限制历史记录大小
  if (operationHistory.length > maxHistorySize) {
    operationHistory.shift();
    currentHistoryIndex--;
  }
  
  console.log('📝 记录操作:', type, '事件ID:', event.id, '历史位置:', currentHistoryIndex);
  updateUndoRedoButtons();
}

/**
 * 撤回操作
 */
function undo() {
  if (currentHistoryIndex < 0) {
    console.log('⏪ 没有可撤回的操作');
    return;
  }
  
  var operation = operationHistory[currentHistoryIndex];
  console.log('⏪ 撤回操作:', operation.type, '事件ID:', operation.eventData.id);
  
  isUndoRedoOperation = true; // 标记为撤回操作
  
  try {
    if (operation.type === 'add') {
      // 撤回添加操作：删除事件（包括重复事件）
      if (operation.allEvents && operation.allEvents.length > 1) {
        // 重复事件
        operation.allEvents.forEach(eventData => {
          var eventToRemove = calendar.getEventById(eventData.id);
          if (eventToRemove) {
            eventToRemove.remove();
          }
        });
      } else {
        // 单个事件
        var eventToRemove = calendar.getEventById(operation.eventData.id);
        if (eventToRemove) {
          eventToRemove.remove();
        }
      }
    } else if (operation.type === 'delete') {
      // 撤回删除操作：重新添加事件
      if (operation.allEvents && operation.allEvents.length > 1) {
        // 重复事件
        operation.allEvents.forEach(eventData => {
          calendar.addEvent({
            id: eventData.id,
            title: eventData.title,
            start: eventData.start,
            end: eventData.end,
            allDay: eventData.allDay,
            backgroundColor: eventData.backgroundColor,
            borderColor: eventData.borderColor,
            extendedProps: eventData.extendedProps
          });
        });
      } else {
        // 单个事件
        calendar.addEvent({
          id: operation.eventData.id,
          title: operation.eventData.title,
          start: operation.eventData.start,
          end: operation.eventData.end,
          allDay: operation.eventData.allDay,
          backgroundColor: operation.eventData.backgroundColor,
          borderColor: operation.eventData.borderColor,
          extendedProps: operation.eventData.extendedProps
        });
      }
    } else if (operation.type === 'edit' || operation.type === 'move' || operation.type === 'resize') {
      // 撤回编辑/移动/调整大小操作：恢复到原始状态
      var eventToRestore = calendar.getEventById(operation.eventData.id);
      if (eventToRestore && operation.oldData) {
        eventToRestore.setProp('title', operation.oldData.title);
        eventToRestore.setStart(operation.oldData.start);
        eventToRestore.setEnd(operation.oldData.end);
        eventToRestore.setProp('backgroundColor', operation.oldData.backgroundColor);
        eventToRestore.setProp('borderColor', operation.oldData.borderColor);
      }
    }
    
    currentHistoryIndex--;
    saveEvents();
    
    // 退出编辑模式
    if (isEditingMode) {
      forceExitEditingMode();
    }
    
  } catch (error) {
    console.error('❌ 撤回操作失败:', error);
  } finally {
    isUndoRedoOperation = false;
    updateUndoRedoButtons();
  }
}

/**
 * 复原操作
 */
function redo() {
  if (currentHistoryIndex >= operationHistory.length - 1) {
    console.log('⏩ 没有可复原的操作');
    return;
  }
  
  currentHistoryIndex++;
  var operation = operationHistory[currentHistoryIndex];
  console.log('⏩ 复原操作:', operation.type, '事件ID:', operation.eventData.id);
  
  isUndoRedoOperation = true; // 标记为复原操作
  
  try {
    if (operation.type === 'add') {
      // 复原添加操作：重新添加事件
      if (operation.allEvents && operation.allEvents.length > 1) {
        // 重复事件
        operation.allEvents.forEach(eventData => {
          calendar.addEvent({
            id: eventData.id,
            title: eventData.title,
            start: eventData.start,
            end: eventData.end,
            allDay: eventData.allDay,
            backgroundColor: eventData.backgroundColor,
            borderColor: eventData.borderColor,
            extendedProps: eventData.extendedProps
          });
        });
      } else {
        // 单个事件
        calendar.addEvent({
          id: operation.eventData.id,
          title: operation.eventData.title,
          start: operation.eventData.start,
          end: operation.eventData.end,
          allDay: operation.eventData.allDay,
          backgroundColor: operation.eventData.backgroundColor,
          borderColor: operation.eventData.borderColor,
          extendedProps: operation.eventData.extendedProps
        });
      }
    } else if (operation.type === 'delete') {
      // 复原删除操作：删除事件
      if (operation.allEvents && operation.allEvents.length > 1) {
        // 重复事件
        operation.allEvents.forEach(eventData => {
          var eventToRemove = calendar.getEventById(eventData.id);
          if (eventToRemove) {
            eventToRemove.remove();
          }
        });
      } else {
        // 单个事件
        var eventToRemove = calendar.getEventById(operation.eventData.id);
        if (eventToRemove) {
          eventToRemove.remove();
        }
      }
    } else if (operation.type === 'edit' || operation.type === 'move' || operation.type === 'resize') {
      // 复原编辑/移动/调整大小操作：应用新的更改
      var eventToEdit = calendar.getEventById(operation.eventData.id);
      if (eventToEdit) {
        eventToEdit.setProp('title', operation.eventData.title);
        eventToEdit.setStart(operation.eventData.start);
        eventToEdit.setEnd(operation.eventData.end);
        eventToEdit.setProp('backgroundColor', operation.eventData.backgroundColor);
        eventToEdit.setProp('borderColor', operation.eventData.borderColor);
      }
    }
    
    saveEvents();
    
    // 退出编辑模式
    if (isEditingMode) {
      forceExitEditingMode();
    }
    
  } catch (error) {
    console.error('❌ 复原操作失败:', error);
  } finally {
    isUndoRedoOperation = false;
    updateUndoRedoButtons();
  }
}

/**
 * 更新撤回/复原按钮状态
 */
function updateUndoRedoButtons() {
  var canUndo = currentHistoryIndex >= 0;
  var canRedo = currentHistoryIndex < operationHistory.length - 1;
  
  console.log('🔄 更新按钮状态 - 可撤回:', canUndo, '可复原:', canRedo);
  
  // 更新UI按钮的启用/禁用状态
  var undoBtn = document.getElementById('undoBtn');
  var redoBtn = document.getElementById('redoBtn');
  
  if (undoBtn) {
    undoBtn.disabled = !canUndo;
    undoBtn.title = canUndo ? 
      `撤回上一步操作 (Ctrl+Z) - ${operationHistory[currentHistoryIndex]?.type}` : 
      '没有可撤回的操作';
  }
  
  if (redoBtn) {
    redoBtn.disabled = !canRedo;
    redoBtn.title = canRedo ? 
      `复原上一步操作 (Ctrl+Y) - ${operationHistory[currentHistoryIndex + 1]?.type}` : 
      '没有可复原的操作';
  }
}

/**
 * 获取重复频率的中文标签
 */
function getRepeatLabel(frequency) {
  var labels = {
    'daily': '每天',
    'weekly': '每周',
    'monthly': '每月',
    'yearly': '每年'
  };
  return labels[frequency] || '';
}

/**
 * 生成重复事件列表
 */
function generateRepeatEvents(baseEvent, count) {
  var events = [];
  var startDate = new Date(baseEvent.start);
  var endDate = baseEvent.end ? new Date(baseEvent.end) : null;
  
  for (var i = 0; i < count; i++) {
    var eventDate = new Date(startDate);
    var eventEndDate = endDate ? new Date(endDate) : null;
    
    // 根据重复频率计算日期
    switch (baseEvent.extendedProps.repeatFrequency) {
      case 'daily':
        eventDate.setDate(startDate.getDate() + i);
        if (eventEndDate) eventEndDate.setDate(endDate.getDate() + i);
        break;
      case 'weekly':
        eventDate.setDate(startDate.getDate() + (i * 7));
        if (eventEndDate) eventEndDate.setDate(endDate.getDate() + (i * 7));
        break;
      case 'monthly':
        eventDate.setMonth(startDate.getMonth() + i);
        if (eventEndDate) eventEndDate.setMonth(endDate.getMonth() + i);
        break;
      case 'yearly':
        eventDate.setFullYear(startDate.getFullYear() + i);
        if (eventEndDate) eventEndDate.setFullYear(endDate.getFullYear() + i);
        break;
    }
    
    events.push({
      id: baseEvent.extendedProps.seriesId + '_' + i,
      title: baseEvent.title,
      start: eventDate,
      end: eventEndDate,
      allDay: baseEvent.allDay,
      backgroundColor: baseEvent.backgroundColor,
      borderColor: baseEvent.borderColor,
      extendedProps: {
        originalTitle: baseEvent.extendedProps.originalTitle,
        repeatFrequency: baseEvent.extendedProps.repeatFrequency,
        repeatCount: baseEvent.extendedProps.repeatCount,
        seriesId: baseEvent.extendedProps.seriesId,
        seriesIndex: i
      }
    });
  }
  
  return events;
}

/**
 * 显示重复事件编辑选择对话框
 */
function showRepeatEditDialog(event, changes, callback) {
  var seriesId = event.extendedProps?.seriesId;
  var repeatFrequency = event.extendedProps?.repeatFrequency;
  
  // 调试信息：打印事件的扩展属性
  console.log('🔍 检查编辑事件扩展属性:', {
    id: event.id,
    title: event.title,
    extendedProps: event.extendedProps,
    seriesId: seriesId,
    seriesIndex: event.extendedProps?.seriesIndex,
    repeatFrequency: repeatFrequency,
    changes: changes
  });
  
  // 非重复事件，直接编辑
  if (!seriesId || repeatFrequency === 'none') {
    console.log('📝 非重复事件，直接编辑');
    callback(['current']);
    return;
  }
  
  // 检查重复系列中实际有多少个事件
  var seriesEvents = calendar.getEvents().filter(e => 
    e.extendedProps?.seriesId === seriesId
  );
  
  // 如果系列中只有一个事件，也直接编辑
  if (seriesEvents.length <= 1) {
    console.log('📝 重复系列只有一个事件，直接编辑');
    callback(['current']);
    return;
  }
  
  console.log('📝 重复事件，显示编辑选项对话框');
  
  var modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  var dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 10px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;
  
  // 生成更改描述
  var changeDescription = '';
  if (changes.title) {
    changeDescription += `• 标题：${changes.title}\n`;
  }
  if (changes.color) {
    changeDescription += `• 颜色：${changes.color}\n`;
  }
  if (changes.opacity !== undefined) {
    changeDescription += `• 透明度：${(changes.opacity * 100).toFixed(0)}%\n`;
  }
  
  dialog.innerHTML = `
    <h3 style="margin-top: 0;">✏️ 编辑重复事件</h3>
    <p>这是一个重复事件，请选择编辑范围（可多选）：</p>
    <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0; font-family: monospace; white-space: pre-line; border-left: 3px solid #007bff;">${changeDescription}</div>
    <div style="margin: 15px 0;">
      <label style="display: block; margin-bottom: 8px;">
        <input type="checkbox" id="editCurrent" checked> 修改当前事件
      </label>
      <label style="display: block; margin-bottom: 8px;">
        <input type="checkbox" id="editFuture"> 修改当前事件以后的重复事件
      </label>
      <label style="display: block; margin-bottom: 8px;">
        <input type="checkbox" id="editPast"> 修改当前事件以前的重复事件
      </label>
      <hr style="margin: 12px 0; border: none; border-top: 1px solid #eee;">
      <label style="display: block; margin-bottom: 8px;">
        <input type="checkbox" id="editAll"> 修改所有重复事件
      </label>
    </div>
    <div style="text-align: right; margin-top: 20px;">
      <button onclick="this.closest('.modal').remove()" style="margin-right: 10px; padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">取消</button>
      <button id="confirmEdit" style="padding: 8px 16px; border: none; background: #28a745; color: white; border-radius: 4px; cursor: pointer;">确认修改</button>
    </div>
  `;
  
  modal.className = 'modal';
  modal.appendChild(dialog);
  document.body.appendChild(modal);
  
  // 获取复选框元素
  var editCurrentCheckbox = dialog.querySelector('#editCurrent');
  var editFutureCheckbox = dialog.querySelector('#editFuture');
  var editPastCheckbox = dialog.querySelector('#editPast');
  var editAllCheckbox = dialog.querySelector('#editAll');
  
  // 智能联动逻辑
  function updateCheckboxes() {
    // 当前、以后、以前都选中时，自动选中"修改所有"
    if (editCurrentCheckbox.checked && editFutureCheckbox.checked && editPastCheckbox.checked) {
      editAllCheckbox.checked = true;
    } else {
      editAllCheckbox.checked = false;
    }
  }
  
  // 修改所有选项的联动
  editAllCheckbox.addEventListener('change', function() {
    if (this.checked) {
      // 选中"修改所有"时，自动选中前三个选项
      editCurrentCheckbox.checked = true;
      editFutureCheckbox.checked = true;
      editPastCheckbox.checked = true;
    }
  });
  
  // 前三个选项的联动
  [editCurrentCheckbox, editFutureCheckbox, editPastCheckbox].forEach(checkbox => {
    checkbox.addEventListener('change', updateCheckboxes);
  });
  
  // 确认编辑按钮事件
  dialog.querySelector('#confirmEdit').onclick = function() {
    var editOptions = [];
    if (editCurrentCheckbox.checked) editOptions.push('current');
    if (editFutureCheckbox.checked) editOptions.push('future');
    if (editPastCheckbox.checked) editOptions.push('past');
    if (editAllCheckbox.checked) editOptions.push('all');
    
    // 如果没有选择任何选项，默认修改当前事件
    if (editOptions.length === 0) {
      editOptions.push('current');
    }
    
    modal.remove();
    callback(editOptions);
  };
  
  // 取消按钮事件
  dialog.querySelector('button[onclick="this.closest(\'.modal\').remove()"]').onclick = function() {
    isShowingEditDialog = false; // 重置标志
    modal.remove();
    // 取消时不执行任何编辑操作，但可能需要退出编辑模式
    console.log('❌ 用户取消了重复事件编辑');
    
    // 如果没有待处理的更改，可以退出编辑模式
    if (!pendingTitle && !pendingColor && pendingOpacity === '') {
      setTimeout(function() {
        if (isEditingMode && !isShowingEditDialog) {
          exitEditingMode();
        }
      }, 100);
    }
  };
  
  // 点击背景关闭
  modal.onclick = function(e) {
    if (e.target === modal) {
      isShowingEditDialog = false; // 重置标志
      modal.remove();
      // 取消时不执行任何编辑操作，但可能需要退出编辑模式
      console.log('❌ 用户点击背景取消了重复事件编辑');
      
      // 如果没有待处理的更改，可以退出编辑模式
      if (!pendingTitle && !pendingColor && pendingOpacity === '') {
        setTimeout(function() {
          if (isEditingMode && !isShowingEditDialog) {
            exitEditingMode();
          }
        }, 100);
      }
    }
  };
}

/**
 * 显示重复事件删除选择对话框
 */
function showRepeatDeleteDialog(event, callback) {
  var seriesId = event.extendedProps?.seriesId;
  var repeatFrequency = event.extendedProps?.repeatFrequency;
  
  // 调试信息：打印事件的扩展属性
  console.log('🔍 检查事件扩展属性:', {
    id: event.id,
    title: event.title,
    extendedProps: event.extendedProps,
    seriesId: seriesId,
    seriesIndex: event.extendedProps?.seriesIndex,
    repeatFrequency: repeatFrequency
  });
  
  // 非重复事件，直接删除
  if (!seriesId || repeatFrequency === 'none') {
    console.log('📝 非重复事件，直接删除');
    callback(['current']);
    return;
  }
  
  // 检查重复系列中实际有多少个事件
  var seriesEvents = calendar.getEvents().filter(e => 
    e.extendedProps?.seriesId === seriesId
  );
  
  // 如果系列中只有一个事件，也直接删除
  if (seriesEvents.length <= 1) {
    console.log('📝 重复系列只有一个事件，直接删除');
    callback(['current']);
    return;
  }
  
  console.log('📝 重复事件，显示删除选项对话框');
  
  var modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  var dialog = document.createElement('div');
  dialog.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 10px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;
  
  dialog.innerHTML = `
    <h3 style="margin-top: 0;">🗑️ 删除重复事件</h3>
    <p>这是一个重复事件，请选择删除范围（可多选）：</p>
    <div style="margin: 15px 0;">
      <label style="display: block; margin-bottom: 8px;">
        <input type="checkbox" id="deleteCurrent" checked> 删除当前事件
      </label>
      <label style="display: block; margin-bottom: 8px;">
        <input type="checkbox" id="deleteFuture"> 删除当前事件以后的重复事件
      </label>
      <label style="display: block; margin-bottom: 8px;">
        <input type="checkbox" id="deletePast"> 删除当前事件以前的重复事件
      </label>
      <hr style="margin: 12px 0; border: none; border-top: 1px solid #eee;">
      <label style="display: block; margin-bottom: 8px;">
        <input type="checkbox" id="deleteAll"> 删除所有重复事件
      </label>
    </div>
    <div style="text-align: right; margin-top: 20px;">
      <button onclick="this.closest('.modal').remove()" style="margin-right: 10px; padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">取消</button>
      <button id="confirmDelete" style="padding: 8px 16px; border: none; background: #dc3545; color: white; border-radius: 4px; cursor: pointer;">确认删除</button>
    </div>
  `;
  
  modal.className = 'modal';
  modal.appendChild(dialog);
  document.body.appendChild(modal);
  
  // 获取复选框元素
  var deleteCurrentCheckbox = dialog.querySelector('#deleteCurrent');
  var deleteFutureCheckbox = dialog.querySelector('#deleteFuture');
  var deletePastCheckbox = dialog.querySelector('#deletePast');
  var deleteAllCheckbox = dialog.querySelector('#deleteAll');
  
  // 智能联动逻辑
  function updateCheckboxes() {
    // 当前、以后、以前都选中时，自动选中"删除所有"
    if (deleteCurrentCheckbox.checked && deleteFutureCheckbox.checked && deletePastCheckbox.checked) {
      deleteAllCheckbox.checked = true;
    } else {
      deleteAllCheckbox.checked = false;
    }
  }
  
  // 删除所有选项的联动
  deleteAllCheckbox.addEventListener('change', function() {
    if (this.checked) {
      // 选中"删除所有"时，自动选中前三个选项
      deleteCurrentCheckbox.checked = true;
      deleteFutureCheckbox.checked = true;
      deletePastCheckbox.checked = true;
    }
  });
  
  // 前三个选项的联动
  [deleteCurrentCheckbox, deleteFutureCheckbox, deletePastCheckbox].forEach(checkbox => {
    checkbox.addEventListener('change', updateCheckboxes);
  });
  
  // 确认删除按钮事件
  dialog.querySelector('#confirmDelete').onclick = function() {
    var deleteOptions = [];
    if (deleteCurrentCheckbox.checked) deleteOptions.push('current');
    if (deleteFutureCheckbox.checked) deleteOptions.push('future');
    if (deletePastCheckbox.checked) deleteOptions.push('past');
    if (deleteAllCheckbox.checked) deleteOptions.push('all');
    
    // 如果没有选择任何选项，默认删除当前事件
    if (deleteOptions.length === 0) {
      deleteOptions.push('current');
    }
    
    modal.remove();
    callback(deleteOptions);
  };
  
  // 点击背景关闭
  modal.onclick = function(e) {
    if (e.target === modal) {
      modal.remove();
    }
  };
}

/**
 * 应用重复事件编辑
 */
function applyRepeatEventEdit(event, changes, editOptions) {
  console.log('🔧 开始应用重复事件编辑');
  console.log('  - 当前编辑模式:', isEditingMode);
  console.log('  - 当前选中事件:', selectedEvent?.id, selectedEvent?.title);
  console.log('  - 传入事件:', event.id, event.title);
  console.log('  - 变更内容:', changes);
  console.log('  - 编辑选项:', editOptions);
  
  // 安全检查：确保事件对象有效
  if (!event || !event.id) {
    console.error('❌ 传入的事件对象无效:', event);
    return;
  }
  
  // 再次从日历中获取事件对象，确保它仍然存在
  var currentEvent = calendar.getEventById(event.id);
  if (!currentEvent) {
    console.error('❌ 事件已不存在于日历中:', event.id);
    return;
  }
  
  // 使用重新获取的事件对象
  event = currentEvent;
  
  var eventsToEdit = [];
  var seriesId = event.extendedProps?.seriesId;
  var currentIndex = event.extendedProps?.seriesIndex || 0;
  
  console.log('✏️ 编辑重复事件:', editOptions, '系列ID:', seriesId, '当前索引:', currentIndex);
  
  // 根据选择的选项决定要编辑的事件
  if (editOptions.includes('all')) {
    // 编辑整个系列
    eventsToEdit = calendar.getEvents().filter(e => 
      e.extendedProps?.seriesId === seriesId
    );
    console.log('编辑整个系列，找到', eventsToEdit.length, '个事件');
  } else {
    // 使用Set来收集要编辑的事件ID，避免重复
    var eventIdsToEdit = new Set();
    
    // 分别处理各个选项
    if (editOptions.includes('current')) {
      // 编辑当前事件
      eventIdsToEdit.add(event.id);
      console.log('添加当前事件到编辑列表:', event.id);
    }
    
    if (editOptions.includes('future')) {
      // 编辑当前事件以后的重复事件（不包括当前）
      var futureEvents = calendar.getEvents().filter(e => 
        e.extendedProps?.seriesId === seriesId && 
        e.extendedProps?.seriesIndex > currentIndex
      );
      futureEvents.forEach(e => eventIdsToEdit.add(e.id));
      console.log('添加以后的事件到编辑列表，找到', futureEvents.length, '个事件');
    }
    
    if (editOptions.includes('past')) {
      // 编辑当前事件以前的重复事件（不包括当前）
      var pastEvents = calendar.getEvents().filter(e => 
        e.extendedProps?.seriesId === seriesId && 
        e.extendedProps?.seriesIndex < currentIndex
      );
      pastEvents.forEach(e => eventIdsToEdit.add(e.id));
      console.log('添加以前的事件到编辑列表，找到', pastEvents.length, '个事件');
    }
    
    // 根据收集的ID获取实际的事件对象
    console.log('🔍 开始根据ID查找事件对象...');
    eventsToEdit = [];
    Array.from(eventIdsToEdit).forEach(id => {
      console.log('🔎 查找事件ID:', id);
      var foundEvent = calendar.getEventById(id);
      if (foundEvent) {
        console.log('✅ 找到事件:', foundEvent.id, foundEvent.title);
        eventsToEdit.push(foundEvent);
      } else {
        console.log('❌ 未找到事件ID:', id);
      }
    });
    
    console.log('总共要编辑的事件ID:', Array.from(eventIdsToEdit));
    console.log('实际找到的事件对象:', eventsToEdit.length, '个');
  }
  
  if (eventsToEdit.length === 0) {
    console.log('⚠️ 没有找到要编辑的事件');
    return;
  }
  
  // 记录编辑操作到历史（仅记录第一个事件的变更，代表整个操作）
  if (!isUndoRedoOperation) {
    var oldData = {
      id: event.id,
      title: event.title,
      backgroundColor: event.backgroundColor,
      borderColor: event.borderColor
    };
    recordOperation('edit', event, oldData, eventsToEdit);
  }
  
  // 应用更改到所有选中的事件
  console.log('正在编辑', eventsToEdit.length, '个事件');
  eventsToEdit.forEach(e => {
    console.log('编辑事件:', e.id, e.title);
    
    if (changes.title) {
      // 对于重复事件，需要保持重复标识
      var originalTitle = changes.title;
      var repeatFrequency = e.extendedProps?.repeatFrequency;
      
      if (repeatFrequency && repeatFrequency !== 'none') {
        var repeatLabel = getRepeatLabel(repeatFrequency);
        var displayTitle = `🔁 ${originalTitle} (${repeatLabel})`;
        e.setProp('title', displayTitle);
        
        // 更新扩展属性中的原始标题
        if (e.extendedProps) {
          e.extendedProps.originalTitle = originalTitle;
        }
      } else {
        e.setProp('title', originalTitle);
      }
    }
    
    if (changes.color) {
      var color = changes.color;
      
      e.setProp('backgroundColor', color);
      e.setProp('borderColor', color);
    }
  });
  
  // 保存事件并维护选中状态
  saveEvents();
  
  // 如果当前选中的事件在编辑列表中，确保它仍然保持选中状态
  if (selectedEvent && eventsToEdit.some(e => e.id === selectedEvent.id)) {
    // 重新获取当前选中的事件（可能已被更新）
    var updatedSelectedEvent = calendar.getEventById(selectedEvent.id);
    if (updatedSelectedEvent) {
      // 确保选中状态的视觉效果
      updatedSelectedEvent.setProp('classNames', [...(updatedSelectedEvent.classNames || []).filter(name => name !== 'selected'), 'selected']);
      selectedEvent = updatedSelectedEvent;
      
      // 更新编辑控件以反映当前事件的状态
      var displayTitle = updatedSelectedEvent.extendedProps?.originalTitle || updatedSelectedEvent.title;
      if (displayTitle.startsWith('🔁 ')) {
        var match = displayTitle.match(/^🔁\s+(.+?)\s+\(.+\)$/);
        if (match) {
          displayTitle = match[1];
        }
      }
      
      // 更新输入框内容
      var eventTitleInput = document.getElementById('eventTitleInput');
      if (eventTitleInput && isEditingMode) {
        eventTitleInput.value = displayTitle;
        eventTitle = displayTitle;
      }
      
      console.log('🎯 维护选中事件状态并更新控件:', selectedEvent.id, displayTitle);
    }
  }
  
  console.log('✅ 重复事件编辑完成');
}

/**
 * 删除重复事件
 */
function deleteRepeatEvents(event, deleteOptions) {
  // 安全检查：确保事件对象有效
  if (!event || !event.id) {
    console.error('❌ 传入的事件对象无效:', event);
    return;
  }
  
  // 再次从日历中获取事件对象，确保它仍然存在
  var currentEvent = calendar.getEventById(event.id);
  if (!currentEvent) {
    console.error('❌ 事件已不存在于日历中:', event.id);
    return;
  }
  
  // 使用重新获取的事件对象
  event = currentEvent;
  
  var eventsToDelete = [];
  var seriesId = event.extendedProps?.seriesId;
  var currentIndex = event.extendedProps?.seriesIndex || 0;
  
  console.log('🗑️ 删除重复事件:', deleteOptions, '系列ID:', seriesId, '当前索引:', currentIndex);
  
  // 调试：打印所有日历中的事件
  var allEvents = calendar.getEvents();
  console.log('📋 当前日历中的所有事件:');
  allEvents.forEach(e => {
    console.log(`  - ID: ${e.id}, 标题: ${e.title}, 系列ID: ${e.extendedProps?.seriesId}, 索引: ${e.extendedProps?.seriesIndex}`);
  });
  
  // 根据选择的选项决定要删除的事件
  if (deleteOptions.includes('all')) {
    // 删除整个系列
    eventsToDelete = calendar.getEvents().filter(e => 
      e.extendedProps?.seriesId === seriesId
    );
    console.log('删除整个系列，找到', eventsToDelete.length, '个事件');
  } else {
    // 使用Set来收集要删除的事件ID，避免重复
    var eventIdsToDelete = new Set();
    
    // 分别处理各个选项
    if (deleteOptions.includes('current')) {
      // 删除当前事件
      eventIdsToDelete.add(event.id);
      console.log('添加当前事件到删除列表:', event.id);
    }
    
    if (deleteOptions.includes('future')) {
      // 删除当前事件以后的重复事件（不包括当前）
      var futureEvents = calendar.getEvents().filter(e => 
        e.extendedProps?.seriesId === seriesId && 
        e.extendedProps?.seriesIndex > currentIndex
      );
      futureEvents.forEach(e => eventIdsToDelete.add(e.id));
      console.log('添加以后的事件到删除列表，找到', futureEvents.length, '个事件');
    }
    
    if (deleteOptions.includes('past')) {
      // 删除当前事件以前的重复事件（不包括当前）
      var pastEvents = calendar.getEvents().filter(e => 
        e.extendedProps?.seriesId === seriesId && 
        e.extendedProps?.seriesIndex < currentIndex
      );
      pastEvents.forEach(e => eventIdsToDelete.add(e.id));
      console.log('添加以前的事件到删除列表，找到', pastEvents.length, '个事件');
    }
    
    // 根据收集的ID获取实际的事件对象
    console.log('🔍 开始根据ID查找事件对象...');
    eventsToDelete = [];
    Array.from(eventIdsToDelete).forEach(id => {
      console.log('🔎 查找事件ID:', id);
      var foundEvent = calendar.getEventById(id);
      if (foundEvent) {
        console.log('✅ 找到事件:', foundEvent.id, foundEvent.title);
        eventsToDelete.push(foundEvent);
      } else {
        console.log('❌ 未找到事件ID:', id);
      }
    });
    
    console.log('总共要删除的事件ID:', Array.from(eventIdsToDelete));
    console.log('实际找到的事件对象:', eventsToDelete.length, '个');
  }
  
  if (eventsToDelete.length === 0) {
    console.log('⚠️ 没有找到要删除的事件');
    forceExitEditingMode();
    return;
  }
  
  // 记录删除操作到历史
  if (!isUndoRedoOperation) {
    recordOperation('delete', event, null, eventsToDelete);
  }
  
  // 删除事件
  console.log('正在删除', eventsToDelete.length, '个事件');
  eventsToDelete.forEach(e => {
    console.log('删除事件:', e.id, e.title);
    e.remove();
  });
  
  saveEvents();
  forceExitEditingMode();
}
