viewSaz = (function () {
  let tableContainer, infoContainer, errorContainer, table
  let columns, hiddenColumns, configuration

  setTimeout(() => {
    tableContainer = $('#table-container')
    infoContainer = $('.alert-info')
    errorContainer = $('.alert-danger')
    columns = [
      { data: 'Number', title: '#' },
      { data: 'Timeline', title: 'Timeline' },
      { data: 'Method', title: 'Method' },
      { data: 'StatusCode', title: 'Status' },
      { data: 'URL', title: 'URL' },
      { data: 'Scheme', title: 'Scheme' },
      { data: 'Host', title: 'Host' },
      { data: 'Port', title: 'Port', className: 'dt-right' },
      { data: 'HostAndPort', title: 'Host+Port' },
      { data: 'Path', title: 'Path' },
      { data: 'Query', title: 'Query' },
      { data: 'PathAndQuery', title: 'Path+Query' },
      { data: 'BeginTime', title: 'Begin' },
      { data: 'EndTime', title: 'End' },
      { data: 'Duration', title: 'Duration' },
      { data: 'SendingTime', title: 'Sending' },
      { data: 'RespondingTime', title: 'Responding' },
      { data: 'ReceivingTime', title: 'Receiving' },
      {
        data: 'Size',
        title: 'Size',
        className: 'dt-right',
        render: function ( data, type, row) {
          if (type === 'display' || type === 'filter') {
            return formatSize(data)
          }
          return data
        }
      },
      { data: 'Encoding', title: 'Encoding' },
      { data: 'Caching', title: 'Caching', orderable: false },
      { data: 'Process', title: 'Process' }
    ]
    hiddenColumns = [
      'Scheme', 'Host', 'Port', 'HostAndPort', 'Path', 'Query', 'PathAndQuery',
      'BeginTime', 'EndTime', 'SendingTime', 'RespondingTime', 'ReceivingTime'
    ]
    loadConfiguration()
  })

  function viewSaz (saz) {
    const [file] = saz.files
    if (file) {
      loadSaz(file)
        .then(displaySaz)
        .catch(displayError)
    } else {
      resetPage()
      infoContainer.show()
    }
  }

  function resetPage () {
    infoContainer.hide()
    errorContainer.hide()
    if (table) {
      const oldTable = table
      table = undefined
      oldTable.destroy()
      tableContainer.html('')
    }
  }

  function loadSaz (file) {
    const formData = new FormData()
    formData.append('saz', file)
    return $.ajax({
      method: 'POST',
      url: '/saz',
      data: formData,
      contentType: false,
      processData: false
    })
  }

  function displaySaz (response) {
    const { columns: columnSettings, order: orderSettings, search } = configuration
    for (const column of columns) {
      const settings = columnSettings[column.data]
      column.visible = settings && settings.visible
    }
    const { column: orderColumn, descending } = orderSettings
    const order = [
      columns.findIndex(({ data }) => data === orderColumn),
      descending ? 'desc' : 'asc'
    ]
    const lastTimeLine = response[response.length - 1].Timeline
    const durationPrecision = lastTimeLine.startsWith('00:00')
      ? 6 : lastTimeLine.startsWith('00') ? 3 : 0
    const data = response.map(session => ({
      Number: session.Number,
      Timeline: formatDuration(session.Timeline, durationPrecision),
      Method: session.Request.Method,
      StatusCode: session.Response.StatusCode,
      URL: formatURL(session.Request.URL.Full),
      Scheme: formatScheme(session.Request.URL.Scheme),
      Host: session.Request.URL.Host,
      Port: formatPort(session.Request.URL.Port, session.Request.URL.Scheme),
      HostAndPort: session.Request.URL.HostAndPort,
      Path: formatPathOrQuery(session.Request.URL.Path),
      Query: formatPathOrQuery(session.Request.URL.Query),
      PathAndQuery: formatPathOrQuery(session.Request.URL.PathAndQuery),
      BeginTime: formatTime(session.Timers.ClientBeginRequest),
      EndTime: formatTime(session.Timers.ClientDoneResponse),
      Duration: formatDuration(session.Timers.RequestResponseTime, durationPrecision),
      SendingTime: formatDuration(session.Timers.RequestSendTime, durationPrecision),
      RespondingTime: formatDuration(session.Timers.ServerProcessTime, durationPrecision),
      ReceivingTime: formatDuration(session.Timers.ResponseReceiveTime, durationPrecision),
      Size: session.Response.ContentLength,
      Encoding: session.Flags.Encoding,
      Caching: session.Flags.Caching,
      Process: session.Flags.Process
    }))
    resetPage()
    table = $('<table class="table table-sm table-striped table-hover nowrap compact display">')
        .appendTo(tableContainer)
        .on('column-visibility.dt', columnVisibilityChanged)
        .on('search.dt', filterChanged)
        .on( 'order.dt', orderChanged)
        .DataTable({
          columns,
          data,
          order,
          search: { search },
          dom: '<"top"ifBR>rtS',
          scrollX: true,
          scrollY: '65vh',
          scrollCollapse: true,
          deferRender: true,
          scroller: true,
          colReorder: true,
          fixedColumns: { leftColumns: 1 },
          buttons: [
            {
              extend: 'colvis',
              text: 'Columns'
            },
            'copy', 'print',
            {
              extend: 'collection',
              text: 'Export',
              buttons: [ 'csv', 'excel', 'pdf' ]
            }
          ]
        })
  }

  function displayError (response) {
    let title, text
    if (response instanceof Error) {
      text = response.message
    } else {
      title = response.status && `${response.status} (${response.statusText})`
      text = response.responseText || 'Connection failed.'
    }
    resetPage()
    if (title) {
      errorContainer.find('h4').show().text(title)
    } else {
      errorContainer.find('h4').hide()
    }
    errorContainer.show().find('p').text(text)
  }

  function formatURL (url) {
    return shortenString(url, 160)
  }

  function formatScheme (scheme) {
    return scheme || 'N/A'
  }

  function formatPort (port, scheme) {
    return port ? +port : scheme === 'https' ? 443 : 80
  }

  function formatPathOrQuery (path) {
    return shortenString(path, 80)
  }

  function formatDuration (duration, precision) {
    duration = duration.substr(precision)
    let [seconds, milliseconds] = duration.split('.')
    milliseconds = padThousands(Math.round(+milliseconds / 1000))
    return `${seconds}.${milliseconds}`
  }

  function formatTime (duration) {
    return duration.substr(14, 12)
  }

  function formatSize (size) {
    if (size < 0) {
      return 'N/A'
    }
    return formatNumber(size)
  }

  function formatNumber (number) {
    let output = number.toString()
    for (let outputIndex = output.length; outputIndex > 3;) {
      outputIndex -= 3
      output = output.substr(0, outputIndex) + ',' + output.substr(outputIndex)
    }
    return output
  }

  function shortenString (string, length) {
    const regexp = new RegExp(`^(.{${length}}).*$`)
    return string.replace(regexp, '$1...')
  }

  function padThousands (number) {
    return number > 99 ? number : number > 9 ? '0' + number : '00' + number
  }

  function loadConfiguration () {
    configuration = JSON.parse(localStorage.getItem('prantlf/sazview') || '{}')
    let { columns, order, search } = configuration
    if (columns === undefined) {
      configuration.columns = columns = {}
    }
    for (const column of hiddenColumns) {
      if (columns[column] === undefined) {
        columns[column] = { visible: false }
      }
    }
    if (order === undefined) {
      configuration.order = { column: 'Number' }
    }
    if (search === undefined) {
      configuration.search = ''
    }
  }

  function saveConfiguration () {
    setTimeout(() =>
      localStorage.setItem('prantlf/sazview', JSON.stringify(configuration)))
  }

  function columnVisibilityChanged (event, settings, column, state) {
    if (table) {
      configuration.columns = settings.aoColumns.reduce((columns, column) => {
        columns[column.mData] = { visible: column.bVisible }
        return columns
      }, {})
      saveConfiguration()
    }
  }

  function filterChanged (event, settings) {
    if (table) {
      var search = settings.oPreviousSearch.sSearch
      if (search !== configuration.search) {
        configuration.search = search
        saveConfiguration()
      }
    }
  }

  function orderChanged (event, settings, state) {
    if (table) {
      const order = settings.aaSorting[0];
      const newOrder = { column: columns[order[0]].data, descending: order[1] === 'desc' }
      oldOrder = configuration.order
      if (newOrder.column !== oldOrder.column || newOrder.descending !== oldOrder.descending) {
        configuration.order = newOrder
        saveConfiguration()
      }
    }
  }

  return viewSaz
}())
