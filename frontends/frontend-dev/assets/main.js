
import MapMaker from './lib/map_maker/map_maker.js';

init();

function init() {
	if (document.readyState === 'complete') start();
	else document.addEventListener('readystatechange', init);
}

async function start() {
	const id = (new URLSearchParams(window.location.search)).get('id');
	if (!id) throw Error('id is not defined');

	await MapMaker(maplibregl, 'map', `/tiles/${id}/`);
}
