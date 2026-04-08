const assert = require('assert');

const teacher = require('./app.js');

const roomLogin = teacher.resolveLoginPath('room');
assert.deepStrictEqual(roomLogin, { route: 'check', contextKey: 'roomDirect' });

const orgLogin = teacher.resolveLoginPath('org');
assert.deepStrictEqual(orgLogin, { route: 'courses', contextKey: 'orgPortal' });

const autoLogin = teacher.resolveLoginPath('auto');
assert.deepStrictEqual(autoLogin, { route: 'live', contextKey: 'autoLaunch' });

const state = teacher.createLiveState();
assert.equal(state.live.allMuted, false);

teacher.toggleStudentMute(state, 'stu-1');
assert.equal(state.live.students[0].muted, true);

teacher.toggleAllMute(state);
assert.equal(state.live.allMuted, true);
assert.ok(state.live.students.every(function (student) { return student.muted; }));

teacher.sendChatMessage(state, '老师，PPT 清晰吗？', 'teacher');
assert.equal(state.live.messages[state.live.messages.length - 1].content, '老师，PPT 清晰吗？');

teacher.applyVirtualBackground(state, 'aurora');
assert.equal(state.live.selectedBackgroundId, 'aurora');

console.log('teacher/app.test.js passed');
