export function getLogTagByConnection(connection) {
    const id = connection.id || '';
    let username = connection.username || '';
    const fixedLength = 10;
    username = username.substring(0, fixedLength).padEnd(fixedLength, '.');
    return `${(new Date()).toISOString()} [id=${id}] [${username}]`;
}
