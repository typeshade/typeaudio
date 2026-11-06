"""Layer notation for artist-authored procedural studies. No source-video data is copied."""


def layer(identifier, event, family, role, bus, start, duration, *, pitch=180, decay=.2,
          character=.3, seed=101, gain_db=-12, envelope=None, position=(0, 0, -3),
          path=None, spread=.1, send=.4, timing='editorial'):
    return dict(id=identifier, event=event, family=family, role=role, bus=bus,
                start=start, duration=duration, pitch=pitch, decay=decay, character=character,
                seed=seed, gainDb=gain_db,
                gain=envelope or [[0, 0], [.006, 1], [duration-.015, 1], [duration, 0]],
                position=path or [[0, *position], [duration, *position]],
                spread=spread, roomSend=send, timing=timing)


def bed(prefix, start, end, envelope):
    duration = end-start
    return [layer(prefix+'-air-'+str(i), 'hall', 'air', 'Continuous low hall air', 'space',
                  start, duration, seed=701+i*719, gain_db=-20, envelope=envelope,
                  position=(-4 if i == 0 else 4, 1, -5), spread=.5, send=.12)
            for i in range(2)]


def debris(prefix, event, start, offsets, *, seed, position=(0, 0, -4), gain_db=-16):
    result = []
    for i, offset in enumerate(offsets):
        duration = .42 if i < 2 else .25
        result.append(layer(prefix+'-'+str(i), event, 'stone', 'Secondary fragment contact',
                            'debris', start+offset, duration, pitch=105+i*43,
                            decay=.085 if i < 2 else .04, seed=seed+i*53,
                            gain_db=gain_db-i*1.6, position=position, send=.5))
    return result
